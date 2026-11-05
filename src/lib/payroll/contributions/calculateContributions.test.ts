import { describe, expect, it } from "vitest";
import { calculateContributions, countMondays, monthStart } from "./calculateContributions";
import type { ContributionParameters } from "./types";

const parameters: ContributionParameters = {
  id: "cp1",
  school_id: "s",
  valid_from: "2026-01-01",
  minimum_wage_ves: 130,
  ivss_pct: 4,
  ivss_cap_wages: 5,
  ivss_method: "mondays",
  rpe_pct: 0.5,
  rpe_cap_wages: 10,
  rpe_method: "mondays",
  faov_pct: 1,
  faov_cap_wages: 0,
  faov_method: "monthly",
};

const byKind = (results: ReturnType<typeof calculateContributions>) =>
  Object.fromEntries(results.map((r) => [r.kind, r]));

describe("countMondays", () => {
  it("cuenta los lunes del mes", () => {
    expect(countMondays("2026-11-30")).toBe(5); // 2, 9, 16, 23, 30
    expect(countMondays("2026-12-15")).toBe(4); // 7, 14, 21, 28
    expect(countMondays("2026-02-01")).toBe(4);
  });

  it("da el primer día del mes", () => {
    expect(monthStart("2026-11-30")).toBe("2026-11-01");
  });
});

describe("calculateContributions", () => {
  it("aplica el tope en salarios mínimos y los lunes del mes", () => {
    // Base 2000 Bs: IVSS topado a 5 × 130 = 650; paro forzoso a 1300; FAOV sin tope.
    const r = byKind(calculateContributions({ monthBaseVes: 2000, monthDate: "2026-11-30", parameters }));
    expect(r.ivss.cappedBaseVes).toBe(650);
    expect(r.ivss.mondays).toBe(5);
    expect(r.ivss.amountVes).toBe(30); // 650 × 12 ÷ 52 × 4 % × 5
    expect(r.rpe.cappedBaseVes).toBe(1300);
    expect(r.rpe.amountVes).toBe(7.5); // 1300 × 12 ÷ 52 × 0,5 % × 5
    expect(r.faov.cappedBaseVes).toBe(2000);
    expect(r.faov.mondays).toBeNull();
    expect(r.faov.amountVes).toBe(20);
  });

  it("descuenta solo lo que falta del mes", () => {
    const r = byKind(
      calculateContributions({
        monthBaseVes: 2000,
        monthDate: "2026-11-30",
        parameters,
        previouslyDeductedVes: { ivss: 18, faov: 25 },
      })
    );
    expect(r.ivss.monthTotalVes).toBe(30);
    expect(r.ivss.amountVes).toBe(12);
    expect(r.faov.amountVes).toBe(0); // ya se descontó más de lo que debe el mes
  });

  it("omite los aportes en 0 %", () => {
    const results = calculateContributions({
      monthBaseVes: 1000,
      monthDate: "2026-11-30",
      parameters: { ...parameters, rpe_pct: 0 },
    });
    expect(results.map((r) => r.kind)).toEqual(["ivss", "faov"]);
  });

  it("sin base no descuenta", () => {
    const results = calculateContributions({ monthBaseVes: 0, monthDate: "2026-11-30", parameters });
    expect(results.every((r) => r.amountVes === 0)).toBe(true);
  });
});
