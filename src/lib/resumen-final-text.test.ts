import { describe, expect, it } from "vitest";
import { formatPlanillaStudentText } from "./resumen-final-text";

describe("formatPlanillaStudentText", () => {
  it("preserva Ñ con locale es-VE en planilla 31060", () => {
    const decomposed = "Mu\u006e\u0303oz";
    expect(formatPlanillaStudentText(decomposed, true)).toBe("MUÑOZ");
    expect(formatPlanillaStudentText("Peña", true)).toBe("PEÑA");
  });

  it("usa toUpperCase estándar para planilla 31059", () => {
    expect(formatPlanillaStudentText("garcía", false)).toBe("GARCÍA");
  });
});
