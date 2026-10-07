import { describe, expect, it } from "vitest";
import {
  formatPlanillaStudentNameParts,
  formatPlanillaStudentText,
  isPlanillaPlaceholder,
  orPlanillaEmpty,
  PLANILLA_EMPTY,
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

describe("isPlanillaPlaceholder", () => {
  it("reconoce los rellenos de casilla vacía", () => {
    expect(isPlanillaPlaceholder("*")).toBe(true);
    expect(isPlanillaPlaceholder("***")).toBe(true);
    expect(isPlanillaPlaceholder(" ***** ")).toBe(true);
  });

  it("no confunde datos reales ni vacíos con relleno", () => {
    expect(isPlanillaPlaceholder("")).toBe(false);
    expect(isPlanillaPlaceholder(null)).toBe(false);
    expect(isPlanillaPlaceholder("V 123")).toBe(false);
    expect(isPlanillaPlaceholder("*A*")).toBe(false);
  });
});

describe("relleno de casillas vacías", () => {
  it("usa un relleno por campo: 5 en textos, 2 en EF/día/mes, 4 en año", () => {
    expect(PLANILLA_EMPTY.text).toBe("*****");
    expect(PLANILLA_EMPTY.entidadFederal).toBe("**");
    expect(PLANILLA_EMPTY.dia).toBe("**");
    expect(PLANILLA_EMPTY.mes).toBe("**");
    expect(PLANILLA_EMPTY.anio).toBe("****");
    expect(PLANILLA_EMPTY.short).toBe("*");
    expect(PLANILLA_EMPTY.nota).toBe("**");
  });

  it("rellena solo cuando el valor está vacío", () => {
    expect(orPlanillaEmpty("", PLANILLA_EMPTY.text)).toBe("*****");
    expect(orPlanillaEmpty("   ", PLANILLA_EMPTY.anio)).toBe("****");
    expect(orPlanillaEmpty(null, PLANILLA_EMPTY.dia)).toBe("**");
    expect(orPlanillaEmpty(undefined, PLANILLA_EMPTY.entidadFederal)).toBe("**");
    expect(orPlanillaEmpty(" MI ", PLANILLA_EMPTY.entidadFederal)).toBe("MI");
  });

  it("todos los rellenos se reconocen como relleno (van centrados)", () => {
    for (const v of Object.values(PLANILLA_EMPTY)) expect(isPlanillaPlaceholder(v)).toBe(true);
  });
});
