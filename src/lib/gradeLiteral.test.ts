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

  // La planilla Resumen Final (31059/31060) lleva la nota como entero, así que desde
  // 0fbf925 la función redondea en vez de conservar el decimal.
  it("redondea a entero las materias no literales", () => {
    expect(formatResumenFinalGrade("15", 0, "numeric")).toBe("15");
    expect(formatResumenFinalGrade("14.5", 0, "numeric")).toBe("15");
    expect(formatResumenFinalGrade("14.4", 0, "numeric")).toBe("14");
    expect(formatResumenFinalGrade("19.5", 0, "numeric")).toBe("20");
    expect(formatResumenFinalGrade("18.2", 0, "numeric")).toBe("18");
    expect(formatResumenFinalGrade(null, 0, "numeric")).toBe("");
  });

  it("suma los puntos de ajuste antes de redondear", () => {
    expect(formatResumenFinalGrade("14.4", 1, "numeric")).toBe("15");
  });

  // Mismo zero-padding que la boleta (fmtGradeNum), para no mezclar "9" y "09".
  it("rellena con cero las notas de un dígito", () => {
    expect(formatResumenFinalGrade("9", 0, "numeric")).toBe("09");
    expect(formatResumenFinalGrade("8.6", 0, "numeric")).toBe("09");
    expect(formatResumenFinalGrade("0", 0, "numeric")).toBe("00");
    expect(formatResumenFinalGrade("10", 0, "numeric")).toBe("10");
  });

  it("valor no numérico deja vacío", () => {
    expect(formatResumenFinalGrade("N/A", 0, "numeric")).toBe("");
    expect(formatResumenFinalGrade("   ", 0, "numeric")).toBe("");
  });
});
