import { describe, it, expect } from "vitest";
import { isEffectivelyRequired, isProtectedField } from "./protected-fields";

describe("student protected fields", () => {
  it("protects birth date and sex, used by the enrollment statistics", () => {
    for (const field of ["fecha_nacimiento", "genero", "sexo", " Genero "]) {
      expect(isProtectedField("student", field)).toBe(true);
    }
  });

  it("treats protected fields as required even when the form says otherwise", () => {
    expect(isEffectivelyRequired("student", "genero", false)).toBe(true);
    expect(isEffectivelyRequired("student", "usa_lentes", false)).toBe(false);
  });
});
