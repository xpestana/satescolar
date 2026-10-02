import { describe, expect, it } from "vitest";
import {
  countPrimariaLiterals,
  formatPrimariaCedula,
  normalizePrimariaLiteral,
  primariaFechaRemision,
  primariaGradeOrdinal,
  primariaMesAnioEvaluacion,
} from "./resumen-final-primaria";

describe("formatPrimariaCedula", () => {
  it("separa el tipo de cédula del número con un espacio", () => {
    expect(formatPrimariaCedula("V-11912910676")).toBe("V 11912910676");
    expect(formatPrimariaCedula("e-12345678")).toBe("E 12345678");
    expect(formatPrimariaCedula("V 11488963")).toBe("V 11488963");
    expect(formatPrimariaCedula("V11488963")).toBe("V 11488963");
  });

  it("devuelve vacío sin documento y deja intacto lo que no reconoce", () => {
    expect(formatPrimariaCedula(null)).toBe("");
    expect(formatPrimariaCedula("  ")).toBe("");
    expect(formatPrimariaCedula("12345678")).toBe("12345678");
  });
});

describe("normalizePrimariaLiteral", () => {
  it("acepta A–E en cualquier formato", () => {
    expect(normalizePrimariaLiteral("a")).toBe("A");
    expect(normalizePrimariaLiteral(" E ")).toBe("E");
  });

  it("descarta valores fuera de A–E", () => {
    expect(normalizePrimariaLiteral("P")).toBe("");
    expect(normalizePrimariaLiteral("")).toBe("");
    expect(normalizePrimariaLiteral(null)).toBe("");
  });
});

describe("countPrimariaLiterals", () => {
  it("cuenta cada literal e ignora vacíos", () => {
    expect(countPrimariaLiterals(["A", "a", "B", "", null, "E", "X"])).toEqual({
      A: 2, B: 1, C: 0, D: 0, E: 1,
    });
  });
});

describe("textos de cabecera", () => {
  it("formatea grado, mes de evaluación y fecha de remisión", () => {
    expect(primariaGradeOrdinal("2_grado")).toBe("2°");
    expect(primariaMesAnioEvaluacion("2026-2027")).toBe("Julio 2027");
    expect(primariaFechaRemision("2026-2027")).toBe("12-07-2027");
    expect(primariaMesAnioEvaluacion("sin año")).toBe("");
  });
});
