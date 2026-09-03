/**
 * Reporte de Pagos: **una fila por factura**.
 *
 * Una factura puede cubrir varias cuotas y varios hijos; todo eso se agrega dentro de la misma
 * fila (estudiantes, grados, planes, conceptos y montos) y se puede desplegar para ver el
 * detalle línea por línea. Antes había una fila por cuota y la misma factura aparecía repetida.
 *
 * A diferencia de **Ingresos** (`IncomesReport`), que es un cuadre fiscal de columnas fijas,
 * este reporte es de consulta: trae todo lo que se sabe del pago y se ordena/filtra libremente.
 */

export type PaymentRowKind = "cuota" | "otros" | "exoneracion";

export const ROW_KIND_LABELS: Record<PaymentRowKind, string> = {
  cuota: "Cuota",
  otros: "Otros",
  exoneracion: "Exoneración",
};

/** Detalle de la factura: una cuota cobrada, un ingreso de "Otros" o una cuota exonerada. */
export interface PaymentReportLine {
  id: string;
  kind: PaymentRowKind;
  studentId: string | null;
  studentName: string;
  gradeLabel: string;
  planId: string | null;
  planName: string;
  conceptName: string;
  conceptType: string;
  conceptCurrency: string;
  /** Monto liquidado en la moneda del concepto (USD/EUR); null si la cuota es en VES. */
  originalAmount: number | null;
  amountVes: number;
  discountVes: number;
  discountReason: string;
  exoneratedVes: number;
  exonerationReason: string;
  isPartial: boolean;
}

export interface PaymentReportRow {
  /** Id de la factura; las exoneraciones sin pago usan su propio id. */
  id: string;
  paymentId: string | null;
  invoiceNumber: string;
  controlNumber: string;
  paymentDate: string;
  registeredAt: string;
  status: string;
  /** Estudiantes cubiertos por la factura, en orden y sin repetir. */
  studentNames: string[];
  studentsLabel: string;
  studentDocuments: string;
  gradesLabel: string;
  familyName: string;
  planIds: string[];
  plansLabel: string;
  conceptTypes: string[];
  conceptCurrencies: string[];
  conceptsLabel: string;
  /** Efectivo cobrado en la factura (suma de las líneas). */
  amountVes: number;
  /** `payments.total_amount_ves`, el total emitido. */
  paymentTotalVes: number;
  discountVes: number;
  exoneratedVes: number;
  hasPartial: boolean;
  methodIds: string[];
  methodsLabel: string;
  banks: string;
  references: string;
  paymentCurrencies: string;
  holderName: string;
  holderDocument: string;
  observations: string;
  lines: PaymentReportLine[];
}

export interface PaymentsReportFilters {
  /** Búsqueda libre: factura, control, referencia, estudiante, familia, titular, concepto. */
  search: string;
  dateFrom: string;
  dateTo: string;
  status: "all" | "completed" | "voided";
  kind: "all" | PaymentRowKind;
  conceptType: string;
  planId: string;
  methodId: string;
  conceptCurrency: string;
  minAmount: string;
  maxAmount: string;
  onlyDiscounts: boolean;
  onlyExonerations: boolean;
  onlyPartial: boolean;
}

export const EMPTY_FILTERS: PaymentsReportFilters = {
  search: "",
  dateFrom: "",
  dateTo: "",
  status: "all",
  kind: "all",
  conceptType: "",
  planId: "",
  methodId: "",
  conceptCurrency: "",
  minAmount: "",
  maxAmount: "",
  onlyDiscounts: false,
  onlyExonerations: false,
  onlyPartial: false,
};

export type PaymentsReportSortKey =
  | "invoiceNumber" | "paymentDate" | "studentsLabel" | "familyName"
  | "conceptsLabel" | "plansLabel" | "amountVes" | "paymentTotalVes" | "status";

export type SortDirection = "asc" | "desc";

/** ¿El usuario tiene algún filtro puesto? (decide si el Excel exporta lo filtrado o todo). */
export function hasActiveFilters(filters: PaymentsReportFilters): boolean {
  return (Object.keys(EMPTY_FILTERS) as (keyof PaymentsReportFilters)[])
    .some((key) => filters[key] !== EMPTY_FILTERS[key]);
}

const normalize = (s: string) =>
  (s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/**
 * Compara números de factura tratándolos como número cuando lo son ("016836" > "9836"),
 * y alfabéticamente si no. Las vacías van siempre al final.
 */
export function compareInvoiceNumbers(a: string, b: string): number {
  const rawA = (a || "").trim();
  const rawB = (b || "").trim();
  if (!rawA && !rawB) return 0;
  if (!rawA) return 1;
  if (!rawB) return -1;
  const numA = Number(rawA.replace(/\D/g, ""));
  const numB = Number(rawB.replace(/\D/g, ""));
  const bothNumeric = /\d/.test(rawA) && /\d/.test(rawB) && !Number.isNaN(numA) && !Number.isNaN(numB);
  if (bothNumeric && numA !== numB) return numA - numB;
  return rawA.localeCompare(rawB, "es");
}

/** Texto sobre el que corre la búsqueda libre: la factura y todo su detalle. */
export function rowSearchText(row: PaymentReportRow): string {
  return normalize([
    row.invoiceNumber, row.controlNumber, row.studentsLabel, row.studentDocuments,
    row.familyName, row.holderName, row.holderDocument, row.conceptsLabel, row.plansLabel,
    row.references, row.banks, row.methodsLabel, row.observations,
    ...row.lines.map((l) => `${l.conceptName} ${l.discountReason} ${l.exonerationReason}`),
  ].filter(Boolean).join(" "));
}

export function filterPaymentRows(rows: PaymentReportRow[], filters: PaymentsReportFilters): PaymentReportRow[] {
  const search = normalize(filters.search.trim());
  const min = filters.minAmount === "" ? null : Number(filters.minAmount);
  const max = filters.maxAmount === "" ? null : Number(filters.maxAmount);

  return rows.filter((row) => {
    if (search && !rowSearchText(row).includes(search)) return false;
    if (filters.dateFrom && row.paymentDate < filters.dateFrom) return false;
    if (filters.dateTo && row.paymentDate > filters.dateTo) return false;
    if (filters.status !== "all" && row.status !== filters.status) return false;
    // Los filtros de detalle se cumplen si CUALQUIER línea de la factura los cumple
    if (filters.kind !== "all" && !row.lines.some((l) => l.kind === filters.kind)) return false;
    if (filters.conceptType && !row.conceptTypes.includes(filters.conceptType)) return false;
    if (filters.planId && !row.planIds.includes(filters.planId)) return false;
    if (filters.methodId && !row.methodIds.includes(filters.methodId)) return false;
    if (filters.conceptCurrency && !row.conceptCurrencies.includes(filters.conceptCurrency)) return false;
    if (min != null && !Number.isNaN(min) && row.amountVes < min) return false;
    if (max != null && !Number.isNaN(max) && row.amountVes > max) return false;
    if (filters.onlyDiscounts && row.discountVes <= 0) return false;
    if (filters.onlyExonerations && row.exoneratedVes <= 0) return false;
    if (filters.onlyPartial && !row.hasPartial) return false;
    return true;
  });
}

export function sortPaymentRows(
  rows: PaymentReportRow[],
  key: PaymentsReportSortKey,
  direction: SortDirection,
): PaymentReportRow[] {
  const factor = direction === "asc" ? 1 : -1;
  const compare = (a: PaymentReportRow, b: PaymentReportRow): number => {
    switch (key) {
      case "invoiceNumber": return compareInvoiceNumbers(a.invoiceNumber, b.invoiceNumber);
      case "amountVes": return a.amountVes - b.amountVes;
      case "paymentTotalVes": return a.paymentTotalVes - b.paymentTotalVes;
      case "paymentDate": return (a.paymentDate || "").localeCompare(b.paymentDate || "");
      default: return normalize(String(a[key] ?? "")).localeCompare(normalize(String(b[key] ?? "")), "es");
    }
  };
  // Desempate estable por factura, para que dos corridas den el mismo orden
  return [...rows].sort((a, b) => {
    const result = compare(a, b);
    if (result !== 0) return result * factor;
    const byInvoice = compareInvoiceNumbers(a.invoiceNumber, b.invoiceNumber);
    return byInvoice !== 0 ? byInvoice : a.id.localeCompare(b.id);
  });
}

export interface PaymentsReportTotals {
  /** Facturas mostradas. */
  payments: number;
  /** Líneas de detalle que hay dentro de esas facturas. */
  lines: number;
  amountVes: number;
  discountVes: number;
  exoneratedVes: number;
}

export function summarizePaymentRows(rows: PaymentReportRow[]): PaymentsReportTotals {
  let lines = 0;
  let amountVes = 0;
  let discountVes = 0;
  let exoneratedVes = 0;
  rows.forEach((row) => {
    lines += row.lines.length;
    amountVes += row.amountVes;
    discountVes += row.discountVes;
    exoneratedVes += row.exoneratedVes;
  });
  return {
    payments: rows.length,
    lines,
    amountVes: parseFloat(amountVes.toFixed(2)),
    discountVes: parseFloat(discountVes.toFixed(2)),
    exoneratedVes: parseFloat(exoneratedVes.toFixed(2)),
  };
}

export const PAGE_SIZE = 20;

export function paginate<T>(rows: T[], page: number, pageSize: number = PAGE_SIZE): T[] {
  const start = (page - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

export function pageCount(total: number, pageSize: number = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
