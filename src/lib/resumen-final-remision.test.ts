import { describe, expect, it } from "vitest";
import { defaultFechaRemisionIso, formatFechaRemision, isoToPlanillaDate } from "./resumen-final-remision";

describe("defaultFechaRemisionIso", () => {
  it("es el 31 de julio del año de cierre", () => {
    expect(defaultFechaRemisionIso("2025-2026")).toBe("2026-07-31");
    expect(defaultFechaRemisionIso("2026 / 2027")).toBe("2027-07-31");
  });

  it("sin año escolar reconocible queda vacía", () => {
    expect(defaultFechaRemisionIso("sin año")).toBe("");
    expect(defaultFechaRemisionIso("")).toBe("");
  });
});

describe("isoToPlanillaDate", () => {
  it("pasa de ISO a día-mes-año", () => {
    expect(isoToPlanillaDate("2026-08-15")).toBe("15-08-2026");
    expect(isoToPlanillaDate("2026-07-31T00:00:00")).toBe("31-07-2026");
  });

  it("deja igual lo que no es ISO", () => {
    expect(isoToPlanillaDate(" 31/07/2026 ")).toBe("31/07/2026");
    expect(isoToPlanillaDate("")).toBe("");
  });
});

describe("formatFechaRemision", () => {
  it("usa la fecha guardada si la hay", () => {
    expect(formatFechaRemision("2026-08-15", "2025-2026")).toBe("15-08-2026");
  });

  it("sin fecha guardada usa 31-07 del año de cierre", () => {
    expect(formatFechaRemision(null, "2025-2026")).toBe("31-07-2026");
    expect(formatFechaRemision("", "2025-2026")).toBe("31-07-2026");
    expect(formatFechaRemision(undefined, "sin año")).toBe("");
  });
});
