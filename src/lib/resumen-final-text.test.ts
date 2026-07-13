import { describe, expect, it } from "vitest";
import {
  formatPlanillaStudentNameParts,
  formatPlanillaStudentText,
  repairSpanishEnye,
} from "./resumen-final-text";

describe("formatPlanillaStudentText", () => {
  it("preserva Ñ con locale es-VE en planilla 31060", () => {
    const decomposed = "Mu\u006e\u0303oz";
    expect(formatPlanillaStudentText(decomposed, true)).toBe("MUÑOZ");
    expect(formatPlanillaStudentText("Peña", true)).toBe("PEÑA");
  });

  it("repara eñe ya mayusculada con tilde combinante", () => {
    const broken = "PEN\u0303A";
    expect(repairSpanishEnye(broken).normalize("NFC")).toBe("PEÑA");
    expect(formatPlanillaStudentText(broken, true)).toBe("PEÑA");
  });

  it("formatea cada parte del nombre por separado", () => {
    expect(
      formatPlanillaStudentNameParts(
        ["Mar\u0069\u0301a", "Pe\u00f1a"],
        true,
      ),
    ).toBe("MARÍA PEÑA");
  });

  it("usa toUpperCase estándar para planilla 31059", () => {
    expect(formatPlanillaStudentText("garcía", false)).toBe("GARCÍA");
  });
});
