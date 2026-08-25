import { parseDateOnly } from "@/lib/dateUtils";
import { conceptAmountKey } from "@/lib/invoiceFieldValue";

/** Human-readable labels for every grade_level enum value stored in the DB. */
export const GRADE_LABELS: Record<string, string> = {
  pre_maternal:  "Pre-Maternal",
  maternal:      "Maternal",
  inicial:       "Inicial",
  i_nivel:       "I Nivel",
  ii_nivel:      "II Nivel",
  iii_nivel:     "III Nivel",
  primaria:      "Primaria",
  "1_grado":     "1er Grado",
  "2_grado":     "2do Grado",
  "3_grado":     "3er Grado",
  "4_grado":     "4to Grado",
  "5_grado":     "5to Grado",
  "6_grado":     "6to Grado",
  media_general: "Media General",
  "1_ano":       "1er Año",
  "2_ano":       "2do Año",
  "3_ano":       "3er Año",
  "4_ano":       "4to Año",
  "5_ano":       "5to Año",
  media_tecnica: "Media Técnica",
  "6_ano":       "6to Año",
};

/**
 * Converts a payment record into the flat key→value map used by the invoice overlay.
 *
 * Concept fields use the key format "concept:{payment_concept_id}".
 * If that concept was paid in this payment → value is "✓" and the amount paid is
 * also exposed under "concept:{id}#amount" (used by fields with `show_amount`).
 * If not paid → both keys are absent from the map (nothing prints).
 *
 * The template only prints the concepts whose keys are in this map,
 * so unpaid concepts are automatically skipped.
 */
export function buildInvoiceData(
  payment: any,
  studentName: string,
  gradeLevel: string,
  sectionName: string,
  methodLabel: (raw: string) => string,
): Record<string, string> {
  const date = parseDateOnly(payment.payment_date) ?? new Date(payment.payment_date);
  const fmt  = (n: number) =>
    n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const items:   any[] = payment.payment_items          || [];
  const methods: any[] = payment.payment_method_entries || [];

  // ── Concept marks: one entry per paid concept ─────────────────────────
  // payment_items → payment_plan_concepts.concept_id  (payment_concepts.id)
  const conceptMarks: Record<string, string> = {};
  const conceptTotals: Record<string, number> = {};
  const conceptNames: string[] = [];

  items.forEach((item: any) => {
    const conceptId   = item.payment_plan_concepts?.concept_id;
    const conceptName = item.payment_plan_concepts?.payment_concepts?.name || "";
    if (conceptId) {
      conceptMarks[`concept:${conceptId}`] = "✓";
      // Several items can hit the same concept (e.g. one per student in a family
      // payment) — the invoice prints the total paid for that concept.
      conceptTotals[conceptId] = (conceptTotals[conceptId] || 0) + Number(item.amount_ves || 0);
    }
    if (conceptName) conceptNames.push(conceptName);
  });

  // Amount variant of every concept key — used by fields with `show_amount`
  const conceptAmounts: Record<string, string> = {};
  Object.entries(conceptTotals).forEach(([conceptId, total]) => {
    conceptAmounts[conceptAmountKey(`concept:${conceptId}`)] = fmt(total);
  });

  // ── General summary field (all paid concept names on one line) ────────
  const conceptsAll = conceptNames.join(" / ");

  // ── Payment method text ───────────────────────────────────────────────
  const methodText = methods
    .map((m: any) => {
      const label = methodLabel(m.method);
      const ref   = m.reference_code ? ` (Ref: ${m.reference_code})` : "";
      return `${label}${ref}`;
    })
    .join(", ");

  return {
    invoice_number:      payment.invoice_number || "",
    control_number:      payment.control_number || "",
    date_day:            String(date.getDate()).padStart(2, "0"),
    date_month:          String(date.getMonth() + 1).padStart(2, "0"),
    date_year:           String(date.getFullYear()),
    titular_nombre:      payment.invoice_name || "",
    titular_ci:          payment.invoice_rif  || "",
    student_name:        studentName,
    student_grade:       GRADE_LABELS[gradeLevel] || gradeLevel,
    student_section:     sectionName,
    concepts_all:        conceptsAll,
    ...conceptMarks,
    ...conceptAmounts,
    total_amount:        fmt(Number(payment.total_amount_ves || 0)),
    payment_method_text: methodText,
  };
}
