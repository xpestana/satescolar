import type { OverlayField } from "@/pages/school/InvoiceTemplateConfig";

/** Prefix that identifies a dynamic concept field: "concept:{payment_concept_id}". */
export const CONCEPT_PREFIX = "concept:";

/**
 * Suffix used in the payment data map for the amount paid on a concept.
 * Example: "concept:{id}" → "✓" and "concept:{id}#amount" → "5.000,00".
 */
export const CONCEPT_AMOUNT_SUFFIX = "#amount";

export const isConceptField = (key: string) => key.startsWith(CONCEPT_PREFIX);

export const conceptAmountKey = (key: string) => `${key}${CONCEPT_AMOUNT_SUFFIX}`;

/**
 * Resolves what a template field must print for a given payment.
 *
 * Concept fields print "✓" by default; when the field has `show_amount`
 * they print the amount paid for that concept instead.
 */
export function resolveOverlayValue(field: OverlayField, data: Record<string, string>): string {
  if (isConceptField(field.key) && field.show_amount) {
    return data[conceptAmountKey(field.key)] || "";
  }
  return data[field.key] || "";
}
