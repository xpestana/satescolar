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
 * Supports up to 10 individual concept rows plus a single "concepts_all" summary field.
 */
export function buildInvoiceData(
  payment: any,
  studentName: string,
  gradeLevel: string,
  sectionName: string,
  methodLabel: (raw: string) => string,
): Record<string, string> {
  const date = new Date(payment.payment_date);
  const fmt = (n: number) =>
    n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const items: any[] = payment.payment_items || [];
  const methods: any[] = payment.payment_method_entries || [];

  // Individual concept rows (up to 10)
  const conceptEntries: Record<string, string> = {};
  const conceptNames: string[] = [];

  items.slice(0, 10).forEach((item: any, i: number) => {
    const name   = item.payment_plan_concepts?.payment_concepts?.name || "";
    const amount = item.amount_ves ? fmt(Number(item.amount_ves)) : "";
    conceptEntries[`concept_${i + 1}_name`]   = name;
    conceptEntries[`concept_${i + 1}_amount`] = amount;
    if (name) conceptNames.push(name);
  });

  // General summary field: all concept names on one line
  const conceptsAll = conceptNames.join(" / ");

  const methodText = methods
    .map((m: any) => {
      const label = methodLabel(m.method);
      const ref   = m.reference_code ? ` (Ref: ${m.reference_code})` : "";
      return `${label}${ref}`;
    })
    .join(", ");

  return {
    invoice_number:      payment.invoice_number || "",
    date_day:            String(date.getUTCDate()).padStart(2, "0"),
    date_month:          String(date.getUTCMonth() + 1).padStart(2, "0"),
    date_year:           String(date.getUTCFullYear()),
    titular_nombre:      payment.invoice_name || "",
    titular_ci:          payment.invoice_rif  || "",
    student_name:        studentName,
    // Format the raw DB enum value ("3_ano") into human text ("3er Año")
    student_grade:       GRADE_LABELS[gradeLevel] || gradeLevel,
    student_section:     sectionName,
    concepts_all:        conceptsAll,
    ...conceptEntries,
    total_amount:        fmt(Number(payment.total_amount_ves || 0)),
    payment_method_text: methodText,
  };
}
