import { describe, expect, it } from "vitest";
import { formatResumenFinalGrade } from "./gradeLiteral";

describe("formatResumenFinalGrade", () => {
  it("convierte nota numérica a literal como la boleta", () => {
    expect(formatResumenFinalGrade("19", 0, "literal")).toBe("A");
    expect(formatResumenFinalGrade("16", 0, "literal")).toBe("B");
    expect(formatResumenFinalGrade("13", 0, "literal")).toBe("C");
    expect(formatResumenFinalGrade("10", 0, "literal")).toBe("D");
  });

  it("aplica ajuste antes de convertir a literal", () => {
    expect(formatResumenFinalGrade("18", 1, "literal")).toBe("A");
  });

  it("sin nota deja vacío (no APROBADO ni final_status)", () => {
    expect(formatResumenFinalGrade(null, 0, "literal")).toBe("");
    expect(formatResumenFinalGrade("", 0, "literal")).toBe("");
  });

  it("mantiene formato numérico para materias no literales", () => {
    expect(formatResumenFinalGrade("15", 0, "numeric")).toBe("15");
    expect(formatResumenFinalGrade("14.5", 0, "numeric")).toBe("14.5");
    expect(formatResumenFinalGrade(null, 0, "numeric")).toBe("");
  });
});
