import { describe, expect, it } from "vitest";
import { gradeInWords } from "./grade-in-words";

describe("gradeInWords", () => {
  it("escribe la nota en letras", () => {
    expect(gradeInWords("14")).toBe("CATORCE");
    expect(gradeInWords(20)).toBe("VEINTE");
    expect(gradeInWords("0")).toBe("CERO");
  });

  it("acepta el cero delante de las notas de un dígito", () => {
    expect(gradeInWords("09")).toBe("NUEVE");
    expect(gradeInWords(" 01 ")).toBe("UNO");
  });

  it("lleva tilde en dieciséis", () => {
    expect(gradeInWords("16")).toBe("DIECISÉIS");
  });

  it("queda vacío si no es una nota entera de 0 a 20", () => {
    expect(gradeInWords("")).toBe("");
    expect(gradeInWords(null)).toBe("");
    expect(gradeInWords("21")).toBe("");
    expect(gradeInWords("14.5")).toBe("");
    expect(gradeInWords("A")).toBe("");
    expect(gradeInWords("**")).toBe("");
  });
});
