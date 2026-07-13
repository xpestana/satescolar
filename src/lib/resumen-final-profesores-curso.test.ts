import { describe, expect, it } from "vitest";
import {
  assignViToRows,
  computeColumnWidths,
  computeViStartOffset,
  estimateProfesoresWrapExtra,
  FOOT_V_DATA_H,
  VI_START_AFTER_IV_COLS,
  VI_START_AFTER_IV_COLS_31059,
} from "./resumen-final-profesores-curso";

describe("assignViToRows", () => {
  const slots = [
    { type: "label" as const, text: "PLAN DE ESTUDIO:" },
    { type: "value" as const, text: "CIENCIA Y TECNOLOGÍA" },
    { type: "label" as const, text: "CÓDIGO:" },
    { type: "value" as const, text: "31060" },
    { type: "label" as const, text: "AÑO CURSADO" },
    { type: "value" as const, text: "PRIMERO" },
    { type: "label" as const, text: "SECCIÓN" },
    { type: "value" as const, text: "U" },
    { type: "label" as const, text: "N° DE ESTUDIANTES POR SECCIÓN" },
    { type: "value" as const, text: "13" },
    { type: "label" as const, text: "N° DE ESTUDIANTES EN ESTA PÁGINA" },
    { type: "value" as const, text: "139" },
  ];

  it("distribuye campos verticales en filas 0–8 y conteos en la última fila", () => {
    const rows = assignViToRows(10, slots);
    expect(rows).toHaveLength(10);
    expect(rows[0]).toMatchObject({
      kind: "stack",
      value: "CIENCIA Y TECNOLOGÍA",
    });
    expect(rows[1]).toMatchObject({ kind: "stack", label: "CÓDIGO:" });
    expect(rows[2]).toMatchObject({ kind: "stack", value: "31060" });
    expect(rows[5]).toMatchObject({ kind: "stack", label: "SECCIÓN" });
    expect(rows[6]).toMatchObject({ kind: "stack", value: "U" });
    expect(rows[7]).toMatchObject({ kind: "stack", label: "", value: "" });
    expect(rows[8]).toMatchObject({ kind: "stack", label: "", value: "" });
    expect(rows[9]).toEqual({
      kind: "studentsPair",
      sectionLabel: "N° DE ESTUDIANTES POR SECCIÓN",
      sectionValue: "13",
      pageLabel: "N° DE ESTUDIANTES EN ESTA PÁGINA",
      pageValue: "139",
    });
  });

  it("última fila siempre lleva el par horizontal de estudiantes", () => {
    const rows = assignViToRows(14, slots);
    expect(rows[13].kind).toBe("studentsPair");
    expect(rows[12].kind).toBe("stack");
  });

  it("cubre slots verticales con pocas materias", () => {
    const rows = assignViToRows(6, slots);
    expect(rows[5].kind).toBe("studentsPair");
    expect(rows[4].kind).toBe("stack");
  });
});

describe("computeViStartOffset", () => {
  it("suma las primeras N columnas de materias", () => {
    const stIvCols = [450, 450, 450, 450, 700, 700];
    expect(computeViStartOffset(stIvCols)).toBe(4 * 450);
    expect(computeViStartOffset(stIvCols, 2)).toBe(2 * 450);
  });

  it("tolera menos columnas que el offset solicitado", () => {
    expect(computeViStartOffset([450, 450])).toBe(900);
  });
});

describe("computeColumnWidths", () => {
  const ST_COL_III = 11201;
  const IV_MATERIA_W = 450;
  const nRegular = 8;
  const nProductive = 2;
  const stIvCols = [
    ...Array(nRegular).fill(IV_MATERIA_W),
    ...Array(nProductive).fill(700),
  ];
  const stColIv = stIvCols.reduce((a, b) => a + b, 0);
  const viOffset = 4 * IV_MATERIA_W;

  it("alinea VI desde la 5ª columna de materias", () => {
    const { vCols, viW, vW, allCols } = computeColumnWidths(
      ST_COL_III,
      stColIv,
      IV_MATERIA_W,
      stIvCols,
    );
    const vSum = vCols.reduce((a, b) => a + b, 0);
    expect(vW).toBe(ST_COL_III + viOffset);
    expect(viW).toBe(stColIv - viOffset);
    expect(vSum).toBe(ST_COL_III + viOffset);
    expect(allCols.reduce((a, b) => a + b, 0)).toBe(ST_COL_III + stColIv);
  });

  it("Cédula fija, Área como remanente y N°/Sigla ampliados", () => {
    const { vCols } = computeColumnWidths(
      ST_COL_III,
      stColIv,
      IV_MATERIA_W,
      stIvCols,
    );
    const [nro, sigla, area, profesor, cedula, firma] = vCols;
    expect(nro).toBe(340);
    expect(sigla).toBe(700);
    expect(cedula).toBe(1500);
    expect(firma).toBe(2 * IV_MATERIA_W);
    expect(profesor).toBe(3600 + Math.round(viOffset * 0.55));
    expect(area).toBeGreaterThan(4000);
    expect(vCols.reduce((a, b) => a + b, 0)).toBe(ST_COL_III + viOffset);
  });

  it("31059: VI desde la 9ª materia y reparte espacio extra en área, cédula y profesor", () => {
    const viOffset31059 = computeViStartOffset(stIvCols, VI_START_AFTER_IV_COLS_31059);
    const extraOffset = viOffset31059 - viOffset;
    const { vCols, viW, vW } = computeColumnWidths(
      ST_COL_III,
      stColIv,
      IV_MATERIA_W,
      stIvCols,
      VI_START_AFTER_IV_COLS_31059,
    );
    const base = computeColumnWidths(
      ST_COL_III,
      stColIv,
      IV_MATERIA_W,
      stIvCols,
      VI_START_AFTER_IV_COLS,
    );
    const share = Math.floor(extraOffset / 3);
    const rem = extraOffset - share * 3;

    expect(vW).toBe(ST_COL_III + viOffset31059);
    expect(viW).toBe(stColIv - viOffset31059);
    expect(vCols[2]).toBe(base.vCols[2] + share + (rem > 2 ? 1 : 0));
    expect(vCols[3]).toBe(base.vCols[3] + share + (rem > 0 ? 1 : 0));
    expect(vCols[4]).toBe(base.vCols[4] + share + (rem > 1 ? 1 : 0));
    expect(vCols.reduce((a, b) => a + b, 0)).toBe(vW);
  });

  it("genera 7 columnas totales (6 V + 1 VI)", () => {
    const { allCols } = computeColumnWidths(
      ST_COL_III,
      stColIv,
      IV_MATERIA_W,
      stIvCols,
    );
    expect(allCols).toHaveLength(7);
  });

  it("limita el offset al ancho total de IV", () => {
    const narrowIvCols = [450, 450];
    const narrowColIv = 900;
    const { viW, vW } = computeColumnWidths(
      ST_COL_III,
      narrowColIv,
      IV_MATERIA_W,
      narrowIvCols,
    );
    expect(vW).toBe(ST_COL_III + narrowColIv);
    expect(viW).toBe(0);
  });
});

describe("estimateProfesoresWrapExtra", () => {
  it("suma altura cuando el nombre de materia ocupa varias líneas", () => {
    const extra = estimateProfesoresWrapExtra(
      [
        {
          name: "GEOGRAFIA, HISTORIA Y SOBERANIA NACIONAL",
          teacherName: "DOCENTE",
        },
      ],
      2200,
      3000,
    );
    expect(extra).toBeGreaterThan(0);
    expect(extra).toBeLessThanOrEqual(FOOT_V_DATA_H * 2);
  });

  it("no suma extra para nombres cortos", () => {
    const extra = estimateProfesoresWrapExtra(
      [{ name: "QUIMICA", teacherName: "DOCENTE" }],
      2200,
      3000,
    );
    expect(extra).toBe(0);
  });
});
