/**
 * Counts, by sex, the answers of every "decidable" student form field (select with fixed options
 * or checkbox) from the rows aggregated by `get_enrollment_answer_breakdown`.
 */
import { addToSexCount, emptySexCount } from "./sexCount";
import type { AnswerCount, AnswerRow, ChoiceField, FieldBreakdown } from "./enrollmentStatsTypes";

export const UNANSWERED_LABEL = "Sin respuesta";

const CHECKBOX_OPTIONS = ["true", "false"];
const CHECKBOX_LABELS: Record<string, string> = { true: "Sí", false: "No" };

/** Fixed answer order for a field: its configured options (checkbox → Sí, No). */
function knownValues(field: ChoiceField): string[] {
  return field.field_type === "checkbox" ? CHECKBOX_OPTIONS : field.options;
}

function answerLabel(field: ChoiceField, value: string | null): string {
  if (value == null) return UNANSWERED_LABEL;
  return field.field_type === "checkbox" ? CHECKBOX_LABELS[value] ?? value : value;
}

/**
 * @param sectionIds Sections in scope (grade/section filter). Rows of other sections are ignored.
 * Answers outside the configured options (legacy data) are kept, after the known ones;
 * "Sin respuesta" always goes last.
 */
export function buildAnswerBreakdown(
  rows: AnswerRow[],
  fields: ChoiceField[],
  sectionIds: ReadonlySet<string>,
): FieldBreakdown[] {
  const rowsByField = new Map<string, AnswerRow[]>();
  rows.forEach((row) => {
    if (!sectionIds.has(row.section_id)) return;
    const list = rowsByField.get(row.field_name) ?? [];
    list.push(row);
    rowsByField.set(row.field_name, list);
  });

  return fields.map((field) => {
    const answers = new Map<string | null, AnswerCount>();
    const ensure = (value: string | null) => {
      let answer = answers.get(value);
      if (!answer) {
        answer = { value, label: answerLabel(field, value), counts: emptySexCount() };
        answers.set(value, answer);
      }
      return answer;
    };

    knownValues(field).forEach((value) => ensure(value));
    const total = emptySexCount();
    (rowsByField.get(field.field_name) ?? []).forEach((row) => {
      addToSexCount(ensure(row.answer).counts, row.sex, row.total);
      addToSexCount(total, row.sex, row.total);
    });

    const unanswered = answers.get(null);
    answers.delete(null);
    const ordered = [...answers.values()];
    if (unanswered) ordered.push(unanswered);

    return { fieldName: field.field_name, label: field.field_label, answers: ordered, total };
  });
}
