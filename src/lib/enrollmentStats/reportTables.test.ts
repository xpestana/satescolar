import { describe, it, expect } from "vitest";
import { answerTable, buildReportSheets, demographicsTable, NO_BIRTH_DATE_LABEL } from "./reportTables";
import type { DemographicsBlock, FieldBreakdown } from "./enrollmentStatsTypes";

const block: DemographicsBlock = {
  key: "section:a",
  title: "1er Año - A",
  ages: [
    { age: 11, counts: { male: 8, female: 5, unknown: 0, total: 13 } },
    { age: null, counts: { male: 0, female: 0, unknown: 1, total: 1 } },
  ],
  bySex: { male: 8, female: 5, unknown: 1, total: 14 },
  byDocument: { CI: 10, CE: 3, P: 0, unknown: 1 },
};

describe("demographicsTable", () => {
  it("prints ages, totals, sex and document summary", () => {
    const table = demographicsTable(block, { showUnknownSex: false });
    expect(table.head).toEqual(["Edad", "M", "F", "Total"]);
    expect(table.body).toEqual([
      [11, 8, 5, 13],
      [NO_BIRTH_DATE_LABEL, 0, 0, 1],
    ]);
    expect(table.foot).toEqual([
      ["TOTAL", 8, 5, 14],
      ["Masculino", "", "", 8],
      ["Femenino", "", "", 5],
      ["CI", "", "", 10],
      ["CE", "", "", 3],
      ["Pasaporte", "", "", 0],
      ["Sin documento", "", "", 1],
    ]);
  });

  it("adds the S/D column and row when asked", () => {
    const table = demographicsTable(block, { showUnknownSex: true });
    expect(table.head).toEqual(["Edad", "M", "F", "S/D", "Total"]);
    expect(table.foot[0]).toEqual(["TOTAL", 8, 5, 1, 14]);
    expect(table.foot[3]).toEqual(["Sin sexo", "", "", "", 1]);
  });
});

describe("answerTable", () => {
  it("prints one row per answer plus the total", () => {
    const field: FieldBreakdown = {
      fieldName: "usa_lentes",
      label: "¿Usa lentes?",
      answers: [{ value: "Sí", label: "Sí", counts: { male: 1, female: 2, unknown: 0, total: 3 } }],
      total: { male: 1, female: 2, unknown: 0, total: 3 },
    };
    expect(answerTable(field, { showUnknownSex: false })).toEqual({
      title: "¿Usa lentes?",
      head: ["Respuesta", "M", "F", "Total"],
      body: [["Sí", 1, 2, 3]],
      foot: [["TOTAL", 1, 2, 3]],
    });
  });
});

describe("buildReportSheets", () => {
  it("puts sections first and the grand total last, then the answers sheet", () => {
    const total = { ...block, key: "total", title: "Total" };
    const sheets = buildReportSheets(
      { sectionIds: ["a"], sectionBlocks: [block], gradeBlocks: [], groupBlocks: [], total, hasUnknownSex: true, hasUnknownAge: true },
      [],
    );
    expect(sheets.map((s) => s.name)).toEqual(["Matrícula", "Respuestas"]);
    expect(sheets[0].tables.map((t) => t.title)).toEqual(["1er Año - A", "Total"]);
    expect(sheets[0].tables[0].head).toContain("S/D");
    expect(sheets[1].tables).toEqual([]);
  });
});
