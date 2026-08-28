import { describe, it, expect } from "vitest";
import { pickBoletaTemplate } from "./boletaTemplateSelection";

const withGrades = { id: "a", applicable_grades: ["1_grado", "2_grado"] };
const wildcardNull = { id: "b", applicable_grades: null };
const wildcardEmpty = { id: "c", applicable_grades: [] as string[] };

describe("pickBoletaTemplate", () => {
  it("prefers the template that lists the grade", () => {
    expect(pickBoletaTemplate([wildcardNull, withGrades], "1_grado")?.id).toBe("a");
  });

  it("falls back to the wildcard template when no grade matches", () => {
    expect(pickBoletaTemplate([withGrades, wildcardNull], "5_grado")?.id).toBe("b");
    expect(pickBoletaTemplate([withGrades, wildcardEmpty], "5_grado")?.id).toBe("c");
  });

  it("returns null when nothing applies", () => {
    expect(pickBoletaTemplate([withGrades], "5_grado")).toBeNull();
    expect(pickBoletaTemplate([], "1_grado")).toBeNull();
    expect(pickBoletaTemplate(null, "1_grado")).toBeNull();
    expect(pickBoletaTemplate(undefined, "1_grado")).toBeNull();
  });

  it("keeps the first match when several templates list the same grade", () => {
    const other = { id: "z", applicable_grades: ["1_grado"] };
    expect(pickBoletaTemplate([withGrades, other], "1_grado")?.id).toBe("a");
  });
});
