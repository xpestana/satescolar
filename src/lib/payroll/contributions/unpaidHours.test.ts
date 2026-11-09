import { describe, expect, it } from "vitest";
import { buildSalaryPaymentDraft, type SalaryDraftInput } from "../withholdings/buildPaymentDraft";

const base: SalaryDraftInput = {
  vatEnabled: false,
  islrEnabled: false,
  date: "2026-11-30",
  parameters: [],
  currency: "USD",
  exchangeRate: 887.303,
  ariRates: [],
  lines: [
    { concept_kind: "earning", description: "Sueldo base", amount: 1.5, isTaxable: true, isBaseSalary: true },
    { concept_kind: "earning", description: "Bono", amount: 10, isTaxable: true, isBaseSalary: false },
  ],
  applyDeductions: false,
  monthlyHours: 160,
};

const absence = (draft: ReturnType<typeof buildSalaryPaymentDraft>) => draft.items.find((i) => i.unpaid_hours);

describe("permiso no justificado por horas", () => {
  it("descuenta horas × sueldo base ÷ horas al mes, redondeando solo al final", () => {
    const draft = buildSalaryPaymentDraft({ ...base, unpaidHours: 3 });
    // 1,5 $ × 887,303 = 1.330,9545 Bs; ÷ 160 = 8,3184...; × 3 = 24,9554 → 24,96
    expect(draft.hourlyVes).toBeCloseTo(8.31847, 5);
    expect(absence(draft)).toMatchObject({
      concept_kind: "deduction",
      description: "Permiso no justificado (3 h)",
      amount_ves: 24.96,
      unpaid_hours: 3,
    });
    expect(draft.totals.netVes).toBe(round2(1330.95 + 8873.03 - 24.96));
  });

  it("con menos horas al mes, la hora vale más", () => {
    const draft = buildSalaryPaymentDraft({ ...base, unpaidHours: 3, monthlyHours: 40 });
    expect(absence(draft)?.amount_ves).toBe(99.82); // 1.330,9545 ÷ 40 × 3 = 99,8216
  });

  it("acepta medias horas", () => {
    expect(absence(buildSalaryPaymentDraft({ ...base, unpaidHours: 1.5 }))?.description).toBe("Permiso no justificado (1,5 h)");
  });

  it("pide las horas al mes de la ficha", () => {
    const draft = buildSalaryPaymentDraft({ ...base, unpaidHours: 3, monthlyHours: null });
    expect(absence(draft)).toBeUndefined();
    expect(draft.errors[0]).toMatch(/horas trabaja al mes/);
  });

  it("pide el sueldo base", () => {
    const draft = buildSalaryPaymentDraft({ ...base, unpaidHours: 3, lines: [base.lines[1]] });
    expect(draft.errors[0]).toMatch(/sueldo base/);
  });

  it("sin horas no agrega nada", () => {
    const draft = buildSalaryPaymentDraft(base);
    expect(absence(draft)).toBeUndefined();
    expect(draft.errors).toEqual([]);
  });
});

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
