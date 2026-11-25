import { describe, it, expect } from "vitest";
import { answerTable, buildReportSheets, demographicsTable, NO_BIRTH_DATE_LABEL } from "./reportTables";
import type { DemographicsBlock, FieldBreakdown, SexCount } from "./enrollmentStatsTypes";

const count = (male: number, female: number, unknown = 0): SexCount => ({
  male,
  female,
  unknown,
  total: male + female + unknown,
});

const block: DemographicsBlock = {
  key: "section:a",
  title: "1er Año - A",
  ages: [
    { age: 10, counts: count(0, 0) },
    { age: 11, counts: count(8, 5) },
    { age: 12, counts: count(0, 0) },
    { age: null, counts: count(0, 0, 1) },
  ],
  bySex: count(8, 5, 1),
  byDocument: { CI: 10, CE: 3, P: 0, unknown: 1 },
};

const fullBlock: DemographicsBlock = {
  ...block,
  ages: [{ age: 11, counts: count(8, 5) }],
  bySex: count(8, 5),
  byDocument: { CI: 13, CE: 0, P: 0, unknown: 0 },
};

describe("demographicsTable", () => {
  it("skips ages and summary lines with zero students", () => {
    const table = demographicsTable(fullBlock);
    expect(table.head).toEqual(["Edad", "M", "F", "Total"]);
    expect(table.body).toEqual([[11, 8, 5, 13]]);
    expect(table.foot).toEqual([
      ["TOTAL", 8, 5, 13],
      ["Masculino", "", "", 8],
      ["Femenino", "", "", 5],
      ["CI", "", "", 13],
    ]);
  });

  it("adds the S/D column, 'Sin sexo' and 'Sin fecha' only when the table has such students", () => {
    const table = demographicsTable(block);
    expect(table.head).toEqual(["Edad", "M", "F", "S/D", "Total"]);
    expect(table.body).toEqual([
      [11, 8, 5, 0, 13],
      [NO_BIRTH_DATE_LABEL, 0, 0, 1, 1],
    ]);
    expect(table.foot.map((row) => row[0])).toEqual([
      "TOTAL", "Masculino", "Femenino", "Sin sexo", "CI", "CE", "Sin documento",
    ]);
  });

  it("keeps only the TOTAL row for an empty section", () => {
    const empty = demographicsTable({ ...block, ages: [], bySex: count(0, 0), byDocument: { CI: 0, CE: 0, P: 0, unknown: 0 } });
    expect(empty.body).toEqual([]);
    expect(empty.foot).toEqual([["TOTAL", 0, 0, 0]]);
  });
});

describe("answerTable", () => {
  it("prints only answers someone gave, plus the total", () => {
    const field: FieldBreakdown = {
      fieldName: "pais_nacimiento",
      label: "País",
      answers: [
        { value: "Argentina", label: "Argentina", counts: count(0, 0) },
        { value: "Venezuela", label: "Venezuela", counts: count(1, 2) },
      ],
      total: count(1, 2),
    };
    expect(answerTable(field)).toEqual({
      title: "País",
      head: ["Respuesta", "M", "F", "Total"],
      body: [["Venezuela", 1, 2, 3]],
      foot: [["TOTAL", 1, 2, 3]],
    });
  });
});

describe("buildReportSheets", () => {
  it("puts sections first and the grand total last, and drops unanswered fields", () => {
    const total = { ...block, key: "total", title: "Total" };
    const answered: FieldBreakdown = { fieldName: "a", label: "A", answers: [], total: count(1, 0) };
    const unanswered: FieldBreakdown = { fieldName: "b", label: "B", answers: [], total: count(0, 0) };
    const sheets = buildReportSheets(
      { sectionIds: ["a"], sectionBlocks: [block], gradeBlocks: [], groupBlocks: [], total, hasUnknownSex: true, hasUnknownAge: true },
      [answered, unanswered],
    );
    expect(sheets.map((s) => s.name)).toEqual(["Matrícula", "Respuestas"]);
    expect(sheets[0].tables.map((t) => t.title)).toEqual(["1er Año - A", "Total"]);
    expect(sheets[1].tables.map((t) => t.title)).toEqual(["A"]);
  });
});
