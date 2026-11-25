import type { ChoiceField } from "./enrollmentStatsTypes";

/** Fields already shown by the demographics sheet (sex, document, grade). Same list as the RPC. */
export const EXCLUDED_CHOICE_FIELDS = new Set(["genero", "sexo", "tipo_documento", "nivel_grado"]);

export interface FormFieldLike {
  field_name: string;
  field_label: string;
  field_type: string;
  options: unknown;
}

function optionValue(option: unknown): string | null {
  if (typeof option === "string") return option;
  if (option && typeof option === "object" && "value" in option) {
    const value = (option as { value: unknown }).value;
    return value == null ? null : String(value);
  }
  return null;
}

/**
 * Student form fields whose answers can be counted: checkboxes and selects with fixed options.
 * Mirrors the eligibility rule of `get_enrollment_answer_breakdown`, so geographic selects
 * (no options, they store UUIDs) never show up. Duplicated field names keep the first one.
 */
export function toChoiceFields(fields: FormFieldLike[]): ChoiceField[] {
  const seen = new Set<string>();
  const result: ChoiceField[] = [];
  fields.forEach((field) => {
    if (EXCLUDED_CHOICE_FIELDS.has(field.field_name) || seen.has(field.field_name)) return;
    if (field.field_type === "checkbox") {
      seen.add(field.field_name);
      result.push({ field_name: field.field_name, field_label: field.field_label, field_type: "checkbox", options: [] });
      return;
    }
    if (field.field_type !== "select" || !Array.isArray(field.options)) return;
    const options = field.options.map(optionValue).filter((v): v is string => !!v);
    if (options.length === 0) return;
    seen.add(field.field_name);
    result.push({ field_name: field.field_name, field_label: field.field_label, field_type: "select", options });
  });
  return result;
}
