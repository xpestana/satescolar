/**
 * Reporte de Pagos: una fila por **línea** de pago, no por factura.
 *
 * Una factura puede cubrir varias cuotas (y de varios hijos en modo familia), así que la unidad
 * del reporte es la línea: cada cuota cobrada, cada ingreso de "Otros" y cada cuota exonerada.
 * Así se puede buscar y filtrar por concepto, plan, estudiante o método sin perder el detalle.
 *
 * A diferencia de **Ingresos** (`IncomesReport`), que es un cuadre fiscal de dinero cobrado y
 * tiene columnas fijas, este reporte es de consulta: trae todo lo que se sabe del pago y se
 * ordena/filtra libremente.
 */

export type PaymentRowKind = "cuota" | "otros" | "exoneracion";

export const ROW_KIND_LABELS: Record<PaymentRowKind, string> = {
  cuota: "Cuota",
  otros: "Otros",
  exoneracion: "Exoneración",
};

export interface PaymentReportRow {
  /** Id único de la fila (no del pago): permite varias líneas por factura. */
  id: string;
  kind: PaymentRowKind;
  paymentId: string | null;
  invoiceNumber: string;
  controlNumber: string;
  /** Fecha del pago (ISO yyyy-mm-dd). En exoneraciones sueltas, la fecha en que se aplicó. */
  paymentDate: string;
  registeredAt: string;
  status: string;
  studentId: string | null;
  studentName: string;
  studentDocument: string;
  familyName: string;
  gradeLabel: string;
  planId: string | null;
  planName: string;
  conceptName: string;
  conceptType: string;
  conceptCurrency: string;
  /** Monto liquidado en la moneda del concepto (USD/EUR); null si la cuota es en VES. */
  originalAmount: number | null;
  /** Efectivo de la línea, en VES. */
  amountVes: number;
  discountVes: number;
  discountReason: string;
  exoneratedVes: number;
  exonerationReason: string;
  isPartial: boolean;
  /** Total en VES de la factura a la que pertenece la línea. */
  paymentTotalVes: number;
  methodIds: string[];
  methodsLabel: string;
  banks: string;
  references: string;
  paymentCurrencies: string;
  holderName: string;
  holderDocument: string;
  observations: string;
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
  | "invoiceNumber" | "paymentDate" | "studentName" | "familyName"
  | "conceptName" | "planName" | "amountVes" | "paymentTotalVes" | "status";

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

/** Texto sobre el que corre la búsqueda libre de una fila. */
export function rowSearchText(row: PaymentReportRow): string {
  return normalize([
    row.invoiceNumber, row.controlNumber, row.studentName, row.studentDocument,
    row.familyName, row.holderName, row.holderDocument, row.conceptName, row.planName,
    row.references, row.banks, row.methodsLabel, row.observations,
    row.discountReason, row.exonerationReason,
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
    if (filters.kind !== "all" && row.kind !== filters.kind) return false;
    if (filters.conceptType && row.conceptType !== filters.conceptType) return false;
    if (filters.planId && row.planId !== filters.planId) return false;
    if (filters.methodId && !row.methodIds.includes(filters.methodId)) return false;
    if (filters.conceptCurrency && row.conceptCurrency !== filters.conceptCurrency) return false;
    if (min != null && !Number.isNaN(min) && row.amountVes < min) return false;
    if (max != null && !Number.isNaN(max) && row.amountVes > max) return false;
    if (filters.onlyDiscounts && row.discountVes <= 0) return false;
    if (filters.onlyExonerations && row.exoneratedVes <= 0) return false;
    if (filters.onlyPartial && !row.isPartial) return false;
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
  // Desempate estable por factura y concepto, para que dos corridas den el mismo orden
  return [...rows].sort((a, b) => {
    const result = compare(a, b);
    if (result !== 0) return result * factor;
    const byInvoice = compareInvoiceNumbers(a.invoiceNumber, b.invoiceNumber);
    return byInvoice !== 0 ? byInvoice : a.id.localeCompare(b.id);
  });
}

export interface PaymentsReportTotals {
  rows: number;
  payments: number;
  amountVes: number;
  discountVes: number;
  exoneratedVes: number;
}

/** Totales de lo mostrado. `payments` cuenta facturas distintas, no líneas. */
export function summarizePaymentRows(rows: PaymentReportRow[]): PaymentsReportTotals {
  const invoices = new Set<string>();
  let amountVes = 0;
  let discountVes = 0;
  let exoneratedVes = 0;
  rows.forEach((row) => {
    if (row.paymentId) invoices.add(row.paymentId);
    amountVes += row.amountVes;
    discountVes += row.discountVes;
    exoneratedVes += row.exoneratedVes;
  });
  return {
    rows: rows.length,
    payments: invoices.size,
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
