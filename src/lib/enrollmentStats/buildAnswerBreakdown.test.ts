import { describe, it, expect } from "vitest";
import { buildAnswerBreakdown, UNANSWERED_LABEL } from "./buildAnswerBreakdown";
import { toChoiceFields } from "./choiceFields";
import type { AnswerRow, ChoiceField } from "./enrollmentStatsTypes";

const fields: ChoiceField[] = [
  { field_name: "usa_lentes", field_label: "¿Usa lentes?", field_type: "select", options: ["No", "Sí"] },
  { field_name: "autoriza_fotos", field_label: "Autoriza fotos", field_type: "checkbox", options: [] },
];

const row = (section_id: string, field_name: string, answer: string | null, sex: AnswerRow["sex"], total: number): AnswerRow => ({
  section_id,
  field_name,
  answer,
  sex,
  total,
});

describe("buildAnswerBreakdown", () => {
  it("lists configured options even without answers", () => {
    const [lentes, fotos] = buildAnswerBreakdown([], fields, new Set(["a"]));
    expect(lentes.answers.map((a) => a.label)).toEqual(["No", "Sí"]);
    expect(lentes.total.total).toBe(0);
    expect(fotos.answers.map((a) => a.label)).toEqual(["Sí", "No"]);
  });

  it("counts by sex, maps checkbox values and sends unanswered last", () => {
    const rows = [
      row("a", "usa_lentes", "Sí", "male", 3),
      row("a", "usa_lentes", "Sí", "female", 2),
      row("a", "usa_lentes", null, "female", 1),
      row("a", "usa_lentes", "Tal vez", null, 1),
      row("a", "autoriza_fotos", "true", "male", 4),
    ];
    const [lentes, fotos] = buildAnswerBreakdown(rows, fields, new Set(["a"]));
    expect(lentes.answers.map((a) => a.label)).toEqual(["No", "Sí", "Tal vez", UNANSWERED_LABEL]);
    expect(lentes.answers[1].counts).toEqual({ male: 3, female: 2, unknown: 0, total: 5 });
    expect(lentes.total).toEqual({ male: 3, female: 3, unknown: 1, total: 7 });
    expect(fotos.answers[0]).toMatchObject({ value: "true", label: "Sí", counts: { male: 4, total: 4 } });
  });

  it("ignores rows outside the selected sections", () => {
    const [lentes] = buildAnswerBreakdown([row("b", "usa_lentes", "Sí", "male", 9)], fields, new Set(["a"]));
    expect(lentes.total.total).toBe(0);
  });
});

describe("toChoiceFields", () => {
  it("keeps checkboxes and selects with options, skipping excluded and duplicated fields", () => {
    const result = toChoiceFields([
      { field_name: "genero", field_label: "Género", field_type: "select", options: ["Masculino", "Femenino"] },
      { field_name: "estado_nacimiento", field_label: "Estado", field_type: "select", options: null },
      { field_name: "usa_lentes", field_label: "¿Usa lentes?", field_type: "select", options: ["No", "Sí"] },
      { field_name: "usa_lentes", field_label: "Duplicado", field_type: "select", options: ["X"] },
      { field_name: "talla", field_label: "Talla", field_type: "select", options: [{ value: "S" }, { value: "M" }] },
      { field_name: "acepta", field_label: "Acepta", field_type: "checkbox", options: null },
      { field_name: "nombre", field_label: "Nombre", field_type: "text", options: null },
    ]);
    expect(result.map((f) => f.field_name)).toEqual(["usa_lentes", "talla", "acepta"]);
    expect(result[1].options).toEqual(["S", "M"]);
  });
});
