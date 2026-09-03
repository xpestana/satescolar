import type { PaymentReportRow } from "@/lib/paymentsReport";

/**
 * Arma las filas del Reporte de Pagos a partir de los datos crudos de Supabase.
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

/** Une valores no vacíos y sin repetir ("Zelle · Transferencia"). */
const joinUnique = (values: (string | null | undefined)[], separator = " · ") =>
  Array.from(new Set(values.map((v) => (v || "").trim()).filter(Boolean))).join(separator);

function methodSummary(entries: RawMethodEntry[], methodLabels: Record<string, string>) {
  return {
    methodIds: Array.from(new Set(entries.map((m) => text(m.method)).filter(Boolean))),
    methodsLabel: joinUnique(entries.map((m) => methodLabels[text(m.method)] || text(m.method))),
    banks: joinUnique(entries.map((m) => text(m.bank_name))),
    references: joinUnique(entries.map((m) => text(m.reference_code))),
    paymentCurrencies: joinUnique(entries.map((m) => text(m.currency))),
  };
}

/**
 * Una fila por cuota cobrada (`payment_items`), por ingreso de "Otros" (`payment_others`)
 * y por cuota exonerada (`concept_exonerations`).
 */
export function buildPaymentReportRows(
  payments: RawPayment[],
  exonerations: RawExoneration[] = [],
  context: Partial<PaymentsReportContext> = {},
): PaymentReportRow[] {
  const ctx = { ...EMPTY_CONTEXT, ...context };
  const rows: PaymentReportRow[] = [];
  const studentInfo = (studentId: string | null, fallbackFamily = "") => ({
    studentId,
    studentName: studentId ? (ctx.studentNames[studentId] || "") : "",
    studentDocument: studentId ? (ctx.studentDocuments[studentId] || "") : "",
    familyName: studentId ? (ctx.studentFamilies[studentId] || "") : fallbackFamily,
    gradeLabel: studentId ? (ctx.studentGrades[studentId] || "") : "",
  });

  (payments || []).forEach((payment) => {
    const methods = methodSummary(payment.payment_method_entries || [], ctx.methodLabels);
    const base = {
      paymentId: text(payment.id),
      invoiceNumber: text(payment.invoice_number),
      controlNumber: text(payment.control_number),
      paymentDate: text(payment.payment_date),
      registeredAt: text(payment.created_at),
      status: text(payment.status),
      paymentTotalVes: num(payment.total_amount_ves),
      holderName: text(payment.invoice_name),
      holderDocument: text(payment.invoice_rif),
      observations: text(payment.observations),
      ...methods,
    };

    (payment.payment_items || []).forEach((item) => {
      const planConcept = item.payment_plan_concepts || {};
      const concept = planConcept.payment_concepts || {};
      rows.push({
        ...base,
        id: `item:${item.id}`,
        kind: "cuota",
        ...studentInfo(text(item.student_id) || text(payment.student_id) || null, text(payment.invoice_name)),
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
      rows.push({
        ...base,
        id: `other:${other.id}`,
        kind: "otros",
        ...studentInfo(text(payment.student_id) || null, text(payment.invoice_name)),
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
  });

  const paymentsById = new Map<string, RawPayment>();
  (payments || []).forEach((p) => paymentsById.set(text(p.id), p));

  (exonerations || []).forEach((exoneration) => {
    const paymentId = text(exoneration.payment_id);
    const payment = paymentId ? paymentsById.get(paymentId) : undefined;
    const methods = methodSummary(payment?.payment_method_entries || [], ctx.methodLabels);
    const planConcept = exoneration.payment_plan_concepts || {};
    const concept = planConcept.payment_concepts || {};
    rows.push({
      id: `exoneration:${exoneration.id}`,
      kind: "exoneracion",
      paymentId: paymentId || null,
      invoiceNumber: text(payment?.invoice_number),
      controlNumber: text(payment?.control_number),
      // Sin pago asociado, la fecha del hecho es la de la exoneración
      paymentDate: text(payment?.payment_date) || text(exoneration.created_at).slice(0, 10),
      registeredAt: text(exoneration.created_at),
      status: text(payment?.status) || "completed",
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
      paymentTotalVes: num(payment?.total_amount_ves),
      holderName: text(payment?.invoice_name),
      holderDocument: text(payment?.invoice_rif),
      observations: text(payment?.observations),
      ...methods,
    });
  });

  return rows;
}
