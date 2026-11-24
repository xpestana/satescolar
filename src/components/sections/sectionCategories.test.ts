import { describe, it, expect } from "vitest";
import { buildTechnicalFields, gradeAllowsTechnical, isSectionTaken } from "./sectionCategories";

describe("isSectionTaken", () => {
  const existing = [
    { name: "A", is_technical: false },
    { name: "B", is_technical: null },
    { name: "C", is_technical: true },
  ];

  it("allows the same letter once as regular and once as técnica", () => {
    expect(isSectionTaken(existing, "A", true)).toBe(false);
    expect(isSectionTaken(existing, "C", false)).toBe(false);
  });

  it("rejects the same letter with the same type", () => {
    expect(isSectionTaken(existing, "a", false)).toBe(true);
    expect(isSectionTaken(existing, "B", false)).toBe(true);
    expect(isSectionTaken(existing, "C", true)).toBe(true);
  });

  it("accepts any letter in an empty grade", () => {
    expect(isSectionTaken([], "A", false)).toBe(false);
  });
});

describe("gradeAllowsTechnical", () => {
  it("allows every secondary year and nothing else", () => {
    for (const g of ["1_ano", "2_ano", "3_ano", "4_ano", "5_ano", "6_ano"]) {
      expect(gradeAllowsTechnical(g)).toBe(true);
    }
    for (const g of ["1_grado", "6_grado", "maternal", "i_nivel", ""]) {
      expect(gradeAllowsTechnical(g)).toBe(false);
    }
  });
});

describe("buildTechnicalFields", () => {
  it("stores false and no specialty for non-technical sections", () => {
    expect(buildTechnicalFields("1_ano", false, "Informática")).toEqual({
      error: null,
      fields: { is_technical: false, technical_specialty: null },
    });
  });

  it("ignores the flag on grades that cannot be technical", () => {
    expect(buildTechnicalFields("3_grado", true, "Informática")).toEqual({
      error: null,
      fields: { is_technical: false, technical_specialty: null },
    });
  });

  it("requires the specialty for technical sections", () => {
    expect(buildTechnicalFields("6_ano", true, "   ")).toEqual({
      error: "Indica la especialidad de la sección técnica.",
      fields: { is_technical: false, technical_specialty: null },
    });
  });

  it("trims and collapses spaces in the specialty", () => {
    expect(buildTechnicalFields("6_ano", true, "  Contabilidad   y  Finanzas ")).toEqual({
      error: null,
      fields: { is_technical: true, technical_specialty: "Contabilidad y Finanzas" },
    });
  });
});
