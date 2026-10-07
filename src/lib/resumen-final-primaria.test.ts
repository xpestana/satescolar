import { describe, expect, it } from "vitest";
import {
  countPrimariaLiterals,
  formatPrimariaCedula,
  formatPrimariaNota,
  normalizePrimariaLiteral,
  pickPrimariaFinalResults,
  primariaFechaRemision,
  primariaGradeOrdinal,
  primariaMesAnioEvaluacion,
  sumPrimariaLiteralTotals,
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


describe("formatPrimariaNota (casilla P.)", () => {
  it("redondea a entero y pone cero delante a las de un dígito", () => {
    expect(formatPrimariaNota(20)).toBe("20");
    expect(formatPrimariaNota("19")).toBe("19");
    expect(formatPrimariaNota("17.67")).toBe("18");
    expect(formatPrimariaNota(9)).toBe("09");
    expect(formatPrimariaNota("1")).toBe("01");
  });

  it("sin nota válida queda vacía", () => {
    expect(formatPrimariaNota(null)).toBe("");
    expect(formatPrimariaNota("")).toBe("");
    expect(formatPrimariaNota("abc")).toBe("");
    expect(formatPrimariaNota(21)).toBe("");
  });
});

describe("pickPrimariaFinalResults", () => {
  it("toma literal y nota del mismo registro", () => {
    const r = pickPrimariaFinalResults([
      { student_id: "s1", literal: "", literal_numerico: 15 },
      { student_id: "s1", literal: "a", literal_numerico: 19 },
      { student_id: "s1", literal: "B", literal_numerico: 17 },
    ]);
    expect(r.get("s1")).toEqual({ literal: "A", nota: "19" });
  });

  it("con literal pero sin nota deja la nota vacía", () => {
    const r = pickPrimariaFinalResults([{ student_id: "s1", literal: "C", literal_numerico: null }]);
    expect(r.get("s1")).toEqual({ literal: "C", nota: "" });
  });

  it("sin literal usa la primera nota que haya", () => {
    const r = pickPrimariaFinalResults([
      { student_id: "s1", literal: null, literal_numerico: null },
      { student_id: "s1", literal: "", literal_numerico: "12" },
    ]);
    expect(r.get("s1")).toEqual({ literal: "", nota: "12" });
    expect(pickPrimariaFinalResults([{ student_id: "s2", literal: "", literal_numerico: null }]).has("s2")).toBe(false);
  });
});

describe("sumPrimariaLiteralTotals (P. de la fila TOTAL)", () => {
  it("suma los conteos de A a E", () => {
    expect(sumPrimariaLiteralTotals({ A: 2, B: 3, C: 0, D: 0, E: 0 })).toBe(5);
    expect(sumPrimariaLiteralTotals({ A: 1, B: 1, C: 1, D: 1, E: 1 })).toBe(5);
    expect(sumPrimariaLiteralTotals({ A: 0, B: 0, C: 0, D: 0, E: 0 })).toBe(0);
  });
});
