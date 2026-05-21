/**
 * Converts a payment record into the flat key→value map used by the invoice overlay.
 */
export function buildInvoiceData(
  payment: any,
  studentName: string,
  gradeLevel: string,
  sectionName: string,
  methodLabel: (raw: string) => string,
): Record<string, string> {
  const date = new Date(payment.payment_date);
  const fmt = (n: number) => n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const items: any[] = payment.payment_items || [];
  const methods: any[] = payment.payment_method_entries || [];

  const conceptEntries: Record<string, string> = {};
  items.slice(0, 5).forEach((item: any, i: number) => {
    const name = item.payment_plan_concepts?.payment_concepts?.name || "";
    const amount = item.amount_ves ? fmt(Number(item.amount_ves)) : "";
    conceptEntries[`concept_${i + 1}_name`] = name;
    conceptEntries[`concept_${i + 1}_amount`] = amount;
  });

  const methodText = methods
    .map((m: any) => {
      const label = methodLabel(m.method);
      const ref = m.reference_code ? ` (Ref: ${m.reference_code})` : "";
      return `${label}${ref}`;
    })
    .join(", ");

  return {
    invoice_number: payment.invoice_number || "",
    date_day: String(date.getUTCDate()).padStart(2, "0"),
    date_month: String(date.getUTCMonth() + 1).padStart(2, "0"),
    date_year: String(date.getUTCFullYear()),
    titular_nombre: payment.invoice_name || "",
    titular_ci: payment.invoice_rif || "",
    student_name: studentName,
    student_grade: gradeLevel,
    student_section: sectionName,
    ...conceptEntries,
    total_amount: fmt(Number(payment.total_amount_ves || 0)),
    payment_method_text: methodText,
  };
}
