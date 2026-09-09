import type { PaymentReportLine, PaymentReportRow } from "@/lib/paymentsReport";

/**
 * Arma las filas del Reporte de Pagos a partir de los datos crudos de Supabase.
 *
 * **Una fila por factura.** Las cuotas, los ingresos de "Otros" y las cuotas exoneradas de esa
 * factura viajan dentro, en `lines`, y la UI las despliega — igual que el historial de pagos.
 * Las exoneraciones que no cuelgan de ningún pago forman su propia fila.
 *
 * Recibe las tablas **planas** (pagos, líneas, métodos, otros, exoneraciones y saldo a favor) y
 * las une aquí, en vez de pedirle a PostgREST un embebido anidado: cada nivel de anidamiento
 * vuelve a evaluar las políticas RLS de la tabla padre y era lo que hacía expirar la consulta.
 */

export interface RawMethodEntry {
  payment_id?: string | null;
  method?: string | null;
  currency?: string | null;
  bank_name?: string | null;
  reference_code?: string | null;
}

/** Concepto del plan ya resuelto (catálogo del colegio, se pide una sola vez). */
export interface PlanConceptInfo {
  plan_id?: string | null;
  plan_name?: string | null;
  currency?: string | null;
  concept_id?: string | null;
  concept_name?: string | null;
  concept_type?: string | null;
}

export interface RawPaymentItem {
  id: string;
  payment_id?: string | null;
  student_id?: string | null;
  plan_concept_id?: string | null;
  amount_ves?: number | null;
  original_amount?: number | null;
  is_partial?: boolean | null;
  discount_amount_ves?: number | null;
  discount_reason?: string | null;
}

export interface RawPaymentOther {
  id: string;
  payment_id?: string | null;
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
}

export interface RawExoneration {
  id: string;
  payment_id?: string | null;
  student_id?: string | null;
  plan_concept_id?: string | null;
  amount_ves?: number | null;
  original_amount?: number | null;
  currency?: string | null;
  reason?: string | null;
  created_at?: string | null;
}

/** Movimiento de "saldo a favor": lo genera un sobrante o lo consume una factura. */
export interface RawFamilyCredit {
  entry_type?: string | null;
  amount_ves?: number | null;
  source_payment_id?: string | null;
  applied_payment_id?: string | null;
}

/** Datos auxiliares que no vienen en las tablas de pago. */
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
  /** plan_concept_id → plan y concepto ya resueltos. */
  planConcepts: Record<string, PlanConceptInfo>;
}

export interface PaymentsReportInput {
  payments: RawPayment[];
  items?: RawPaymentItem[];
  methodEntries?: RawMethodEntry[];
  others?: RawPaymentOther[];
  exonerations?: RawExoneration[];
  credits?: RawFamilyCredit[];
}

const EMPTY_CONTEXT: PaymentsReportContext = {
  studentNames: {},
  studentDocuments: {},
  studentGrades: {},
  studentFamilies: {},
  methodLabels: {},
  planConcepts: {},
};

const num = (v: unknown) => Number(v) || 0;
const text = (v: unknown) => (v == null ? "" : String(v));
const round = (n: number) => parseFloat(n.toFixed(2));

/** Valores no vacíos, sin repetir y en orden de aparición. */
const uniq = (values: (string | null | undefined)[]) =>
  Array.from(new Set(values.map((v) => (v || "").trim()).filter(Boolean)));

const joinUnique = (values: (string | null | undefined)[], separator = " · ") =>
  uniq(values).join(separator);

/** Agrupa filas por el id de la factura a la que pertenecen. */
function groupByPayment<T extends { payment_id?: string | null }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  rows.forEach((row) => {
    const id = text(row.payment_id);
    if (!id) return;
    const list = map.get(id);
    if (list) list.push(row); else map.set(id, [row]);
  });
  return map;
}

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
  input: PaymentsReportInput,
  context: Partial<PaymentsReportContext> = {},
): PaymentReportRow[] {
  const ctx = { ...EMPTY_CONTEXT, ...context };
  const { payments = [], items = [], methodEntries = [], others = [], exonerations = [], credits = [] } = input;

  const itemsByPayment = groupByPayment(items);
  const methodsByPayment = groupByPayment(methodEntries);
  const othersByPayment = groupByPayment(others);
  const exonerationsByPayment = groupByPayment(exonerations);
  const looseExonerations = exonerations.filter((e) => !text(e.payment_id));

  // Saldo a favor: lo que la factura generó (sobrante guardado) y lo que consumió
  const creditGenerated = new Map<string, number>();
  const creditUsed = new Map<string, number>();
  credits.forEach((c) => {
    const amount = num(c.amount_ves);
    if (c.entry_type === "credit" && c.source_payment_id) {
      creditGenerated.set(c.source_payment_id, (creditGenerated.get(c.source_payment_id) || 0) + amount);
    }
    if (c.entry_type === "debit" && c.applied_payment_id) {
      creditUsed.set(c.applied_payment_id, (creditUsed.get(c.applied_payment_id) || 0) + amount);
    }
  });

  const studentInfo = (studentId: string | null) => ({
    studentId,
    studentName: studentId ? (ctx.studentNames[studentId] || "") : "",
    gradeLabel: studentId ? (ctx.studentGrades[studentId] || "") : "",
  });

  const planConceptOf = (planConceptId: unknown) => ctx.planConcepts[text(planConceptId)] || {};

  const exonerationLine = (exoneration: RawExoneration): PaymentReportLine => {
    const planConcept = planConceptOf(exoneration.plan_concept_id);
    return {
      id: `exoneration:${exoneration.id}`,
      kind: "exoneracion",
      ...studentInfo(text(exoneration.student_id) || null),
      planId: text(planConcept.plan_id) || null,
      planName: text(planConcept.plan_name),
      conceptName: text(planConcept.concept_name),
      conceptType: text(planConcept.concept_type),
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

  const rows: PaymentReportRow[] = payments.map((payment) => {
    const paymentId = text(payment.id);
    const lines: PaymentReportLine[] = [];

    (itemsByPayment.get(paymentId) || []).forEach((item) => {
      const planConcept = planConceptOf(item.plan_concept_id);
      lines.push({
        id: `item:${item.id}`,
        kind: "cuota",
        ...studentInfo(text(item.student_id) || text(payment.student_id) || null),
        planId: text(planConcept.plan_id) || null,
        planName: text(planConcept.plan_name),
        conceptName: text(planConcept.concept_name),
        conceptType: text(planConcept.concept_type),
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

    (othersByPayment.get(paymentId) || []).forEach((other) => {
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

    (exonerationsByPayment.get(paymentId) || []).forEach((exoneration) => {
      lines.push(exonerationLine(exoneration));
    });

    const summary = summarizeLines(lines, ctx);
    const firstStudentId = lines.map((l) => l.studentId).find(Boolean) || null;
    return {
      id: paymentId,
      paymentId,
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
      creditGeneratedVes: round(creditGenerated.get(paymentId) || 0),
      creditUsedVes: round(creditUsed.get(paymentId) || 0),
      ...methodSummary(methodsByPayment.get(paymentId) || [], ctx.methodLabels),
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
      creditGeneratedVes: 0,
      creditUsedVes: 0,
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
