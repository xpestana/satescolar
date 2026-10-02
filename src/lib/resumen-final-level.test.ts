import { describe, expect, it } from "vitest";
import { isPrimaryGradeLevel, rowsPerPartFor } from "./resumen-final-level";

describe("isPrimaryGradeLevel", () => {
  it("reconoce 1er a 6to grado como primaria", () => {
    for (const g of ["1_grado", "2_grado", "3_grado", "4_grado", "5_grado", "6_grado"]) {
      expect(isPrimaryGradeLevel(g)).toBe(true);
    }
  });

  it("no considera primaria a bachillerato, preescolar ni valores vacíos", () => {
    for (const g of ["1_ano", "6_ano", "i_nivel", "maternal", "", null, undefined]) {
      expect(isPrimaryGradeLevel(g)).toBe(false);
    }
  });
});

describe("rowsPerPartFor", () => {
  it("primaria usa 20 estudiantes por planilla y bachillerato 35", () => {
    expect(rowsPerPartFor("3_grado")).toBe(20);
    expect(rowsPerPartFor("3_ano")).toBe(35);
  });
});
