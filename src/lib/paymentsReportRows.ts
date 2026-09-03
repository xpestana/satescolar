import type { PaymentReportLine, PaymentReportRow } from "@/lib/paymentsReport";

/**
 * Arma las filas del Reporte de Pagos a partir de los datos crudos de Supabase.
 *
 * **Una fila por factura.** Las cuotas, los ingresos de "Otros" y las cuotas exoneradas de esa
 * factura viajan dentro, en `lines`, y la UI las despliega — igual que el historial de pagos.
 * Las exoneraciones que no cuelgan de ningún pago forman su propia fila.
 *
 * Separado de `paymentsReport.ts` (filtros/orden/totales) para que el mapeo de la forma que
 * devuelve la consulta viva en un solo sitio y se pueda probar sin tocar la UI.
 */

export interface RawMethodEntry {
  method?: string | null;
  currency?: string | null;
  bank_name?: string | null;
  reference_code?: string | null;
}

interface RawPlanConcept {
  plan_id?: string | null;
  currency?: string | null;
  /** Necesario para la factura: `buildInvoiceData` marca los conceptos por este id. */
  concept_id?: string | null;
  payment_plans?: { name?: string | null } | null;
  payment_concepts?: { id?: string | null; name?: string | null; concept_type?: string | null } | null;
}

interface RawPaymentItem {
  id: string;
  student_id?: string | null;
  amount_ves?: number | null;
  original_amount?: number | null;
  is_partial?: boolean | null;
  discount_amount_ves?: number | null;
  discount_reason?: string | null;
  payment_plan_concepts?: RawPlanConcept | null;
}

interface RawPaymentOther {
  id: string;
  amount_ves?: number | null;
  notes?: string | null;
}

export interface RawPayment {
  id: string;
  payment_date?: string | null;
  created_at?: string | null;
  status?: string | null;
  invoice_number?: string | null;
  control_number?: string | null;
  invoice_name?: string | null;
  invoice_rif?: string | null;
  observations?: string | null;
  total_amount_ves?: number | null;
  student_id?: string | null;
  payment_method_entries?: RawMethodEntry[] | null;
  payment_items?: RawPaymentItem[] | null;
  payment_others?: RawPaymentOther[] | null;
}

export interface RawExoneration {
  id: string;
  payment_id?: string | null;
  student_id?: string | null;
  amount_ves?: number | null;
  original_amount?: number | null;
  currency?: string | null;
  reason?: string | null;
  created_at?: string | null;
  payment_plan_concepts?: RawPlanConcept | null;
}

/** Datos auxiliares que no vienen embebidos en el pago. */
export interface PaymentsReportContext {
  /** student_id → nombre completo. */
  studentNames: Record<string, string>;
  /** student_id → cédula/documento. */
  studentDocuments: Record<string, string>;
  /** student_id → "3er Año - A". */
  studentGrades: Record<string, string>;
  /** student_id → apellido/nombre de la familia. */
  studentFamilies: Record<string, string>;
  /** id del método del colegio → etiqueta configurada. */
  methodLabels: Record<string, string>;
}

const EMPTY_CONTEXT: PaymentsReportContext = {
  studentNames: {},
  studentDocuments: {},
  studentGrades: {},
  studentFamilies: {},
  methodLabels: {},
};

const num = (v: unknown) => Number(v) || 0;
const text = (v: unknown) => (v == null ? "" : String(v));
const round = (n: number) => parseFloat(n.toFixed(2));

/** Valores no vacíos, sin repetir y en orden de aparición. */
const uniq = (values: (string | null | undefined)[]) =>
  Array.from(new Set(values.map((v) => (v || "").trim()).filter(Boolean)));

const joinUnique = (values: (string | null | undefined)[], separator = " · ") =>
  uniq(values).join(separator);

function methodSummary(entries: RawMethodEntry[], methodLabels: Record<string, string>) {
  return {
    methodIds: uniq(entries.map((m) => text(m.method))),
    methodsLabel: joinUnique(entries.map((m) => methodLabels[text(m.method)] || text(m.method))),
    banks: joinUnique(entries.map((m) => text(m.bank_name))),
    references: joinUnique(entries.map((m) => text(m.reference_code))),
    paymentCurrencies: joinUnique(entries.map((m) => text(m.currency))),
  };
}

/** Agrega en la fila de la factura lo que aportan sus líneas. */
function summarizeLines(lines: PaymentReportLine[], ctx: PaymentsReportContext) {
  const studentIds = uniq(lines.map((l) => l.studentId));
  return {
    studentNames: studentIds.map((id) => ctx.studentNames[id] || "").filter(Boolean),
    studentsLabel: joinUnique(lines.map((l) => l.studentName), " / "),
    studentDocuments: joinUnique(studentIds.map((id) => ctx.studentDocuments[id] || "")),
    gradesLabel: joinUnique(lines.map((l) => l.gradeLabel)),
    planIds: uniq(lines.map((l) => l.planId)),
    plansLabel: joinUnique(lines.map((l) => l.planName)),
    conceptTypes: uniq(lines.map((l) => l.conceptType)),
    conceptCurrencies: uniq(lines.map((l) => l.conceptCurrency)),
    conceptsLabel: joinUnique(lines.map((l) => l.conceptName), ", "),
    amountVes: round(lines.reduce((s, l) => s + l.amountVes, 0)),
    discountVes: round(lines.reduce((s, l) => s + l.discountVes, 0)),
    exoneratedVes: round(lines.reduce((s, l) => s + l.exoneratedVes, 0)),
    hasPartial: lines.some((l) => l.isPartial),
  };
}

export function buildPaymentReportRows(
  payments: RawPayment[],
  exonerations: RawExoneration[] = [],
  context: Partial<PaymentsReportContext> = {},
): PaymentReportRow[] {
  const ctx = { ...EMPTY_CONTEXT, ...context };
  const studentInfo = (studentId: string | null) => ({
    studentId,
    studentName: studentId ? (ctx.studentNames[studentId] || "") : "",
    gradeLabel: studentId ? (ctx.studentGrades[studentId] || "") : "",
  });

  // Exoneraciones agrupadas por la factura en cuyo registro se aplicaron
  const exonerationsByPayment = new Map<string, RawExoneration[]>();
  const looseExonerations: RawExoneration[] = [];
  (exonerations || []).forEach((exoneration) => {
    const paymentId = text(exoneration.payment_id);
    if (!paymentId) { looseExonerations.push(exoneration); return; }
    const list = exonerationsByPayment.get(paymentId) || [];
    list.push(exoneration);
    exonerationsByPayment.set(paymentId, list);
  });

  const exonerationLine = (exoneration: RawExoneration): PaymentReportLine => {
    const planConcept = exoneration.payment_plan_concepts || {};
    const concept = planConcept.payment_concepts || {};
    return {
      id: `exoneration:${exoneration.id}`,
      kind: "exoneracion",
      ...studentInfo(text(exoneration.student_id) || null),
      planId: text(planConcept.plan_id) || null,
      planName: text(planConcept.payment_plans?.name),
      conceptName: text(concept.name),
      conceptType: text(concept.concept_type),
      conceptCurrency: text(exoneration.currency) || "VES",
      originalAmount: exoneration.original_amount == null ? null : num(exoneration.original_amount),
      amountVes: 0,
      discountVes: 0,
      discountReason: "",
      exoneratedVes: num(exoneration.amount_ves),
      exonerationReason: text(exoneration.reason),
      isPartial: false,
    };
  };

  const rows: PaymentReportRow[] = (payments || []).map((payment) => {
    const lines: PaymentReportLine[] = [];

    (payment.payment_items || []).forEach((item) => {
      const planConcept = item.payment_plan_concepts || {};
      const concept = planConcept.payment_concepts || {};
      lines.push({
        id: `item:${item.id}`,
        kind: "cuota",
        ...studentInfo(text(item.student_id) || text(payment.student_id) || null),
        planId: text(planConcept.plan_id) || null,
        planName: text(planConcept.payment_plans?.name),
        conceptName: text(concept.name),
        conceptType: text(concept.concept_type),
        conceptCurrency: text(planConcept.currency) || "VES",
        originalAmount: item.original_amount == null ? null : num(item.original_amount),
        amountVes: num(item.amount_ves),
        discountVes: num(item.discount_amount_ves),
        discountReason: text(item.discount_reason),
        exoneratedVes: 0,
        exonerationReason: "",
        isPartial: Boolean(item.is_partial),
      });
    });

    (payment.payment_others || []).forEach((other) => {
      lines.push({
        id: `other:${other.id}`,
        kind: "otros",
        ...studentInfo(text(payment.student_id) || null),
        planId: null,
        planName: "",
        conceptName: text(other.notes) || "Otros ingresos",
        conceptType: "otros",
        conceptCurrency: "VES",
        originalAmount: null,
        amountVes: num(other.amount_ves),
        discountVes: 0,
        discountReason: "",
        exoneratedVes: 0,
        exonerationReason: "",
        isPartial: false,
      });
    });

    (exonerationsByPayment.get(text(payment.id)) || []).forEach((exoneration) => {
      lines.push(exonerationLine(exoneration));
    });

    const summary = summarizeLines(lines, ctx);
    const firstStudentId = lines.map((l) => l.studentId).find(Boolean) || null;
    return {
      id: text(payment.id),
      paymentId: text(payment.id),
      invoiceNumber: text(payment.invoice_number),
      controlNumber: text(payment.control_number),
      paymentDate: text(payment.payment_date),
      registeredAt: text(payment.created_at),
      status: text(payment.status),
      // La familia sale del primer hijo de la factura; si no hay, del titular facturado
      familyName: (firstStudentId && ctx.studentFamilies[firstStudentId]) || text(payment.invoice_name),
      holderName: text(payment.invoice_name),
      holderDocument: text(payment.invoice_rif),
      observations: text(payment.observations),
      paymentTotalVes: num(payment.total_amount_ves),
      ...methodSummary(payment.payment_method_entries || [], ctx.methodLabels),
      ...summary,
      lines,
    };
  });

  // Exoneraciones sin factura: cada una es su propia fila
  looseExonerations.forEach((exoneration) => {
    const lines = [exonerationLine(exoneration)];
    const summary = summarizeLines(lines, ctx);
    const studentId = text(exoneration.student_id) || null;
    rows.push({
      id: `exoneration:${exoneration.id}`,
      paymentId: null,
      invoiceNumber: "",
      controlNumber: "",
      paymentDate: text(exoneration.created_at).slice(0, 10),
      registeredAt: text(exoneration.created_at),
      status: "completed",
      familyName: (studentId && ctx.studentFamilies[studentId]) || "",
      holderName: "",
      holderDocument: "",
      observations: "",
      paymentTotalVes: 0,
      methodIds: [],
      methodsLabel: "",
      banks: "",
      references: "",
      paymentCurrencies: "",
      ...summary,
      lines,
    });
  });

  return rows;
}
