import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDateOnly } from "@/lib/dateUtils";

/**
 * Recibo de pago en PDF (A4), común al estado de cuenta por estudiante, al de familia y al
 * Reporte de Pagos.
 *
 * Es el comprobante "propio" del sistema: se genera completo, con sus rótulos. **No** sustituye
 * a la factura impresa sobre el formato preimpreso del colegio, que se imprime con
 * `printInvoiceOverlay` respetando milímetro a milímetro la plantilla de `/formatos`.
 */

interface ReceiptItem {
  student_id?: string | null;
  amount_ves?: number | null;
  discount_amount_ves?: number | null;
  discount_reason?: string | null;
  is_partial?: boolean | null;
  payment_plan_concepts?: { payment_concepts?: { name?: string | null } | null } | null;
}

interface ReceiptMethodEntry {
  method?: string | null;
  currency?: string | null;
  amount_original?: number | null;
  exchange_rate?: number | null;
  amount_ves?: number | null;
  reference_code?: string | null;
}

export interface ReceiptPayment {
  id: string;
  payment_date?: string | null;
  status?: string | null;
  invoice_number?: string | null;
  control_number?: string | null;
  invoice_name?: string | null;
  invoice_rif?: string | null;
  total_amount_ves?: number | null;
  student_id?: string | null;
  payment_items?: ReceiptItem[] | null;
  payment_method_entries?: ReceiptMethodEntry[] | null;
}

export interface ReceiptOptions {
  /** Nombre que encabeza el recibo: el estudiante, los hijos o la familia. */
  headerName: string;
  /** Rótulo de esa línea ("Estudiante", "Estudiante(s)", "Familia"…). */
  headerLabel?: string;
  /** Línea extra opcional bajo el nombre (p. ej. la familia en el recibo por hijo). */
  subtitle?: string;
  /** Resuelve la etiqueta configurada de un método de pago. */
  methodLabel: (raw: string) => string;
  /** Con varios hijos en una factura, agrega la columna "Estudiante" por línea. */
  studentNameById?: Record<string, string>;
}

const fmt = (n: number | null | undefined) =>
  Number(n || 0).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Genera el recibo y lo descarga como `recibo_<factura|id>.pdf`. */
export function downloadPaymentReceiptPdf(payment: ReceiptPayment, options: ReceiptOptions): void {
  const { headerName, headerLabel = "Estudiante", subtitle, methodLabel, studentNameById } = options;
  const withStudentColumn = !!studentNameById;
  const items = payment.payment_items || [];
  const entries = payment.payment_method_entries || [];

  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("Recibo de Pago", 105, 20, { align: "center" });

  doc.setFontSize(10);
  let y = 35;
  const line = (txt: string) => { doc.text(txt, 14, y); y += 7; };
  line(`${headerLabel}: ${headerName}`);
  if (subtitle) line(subtitle);
  if (payment.invoice_number) line(`Factura N°: ${payment.invoice_number}${payment.control_number ? `   ·   Control N°: ${payment.control_number}` : ""}`);
  line(`Fecha: ${payment.payment_date ? formatDateOnly(payment.payment_date) : "—"}`);
  line(`Estado: ${payment.status === "voided" ? "Anulado" : "Completado"}`);
  if (payment.invoice_name) line(`Facturado a: ${payment.invoice_name} - ${payment.invoice_rif || ""}`);

  const conceptHead = withStudentColumn
    ? ["Estudiante", "Concepto", "Monto", "Descuento", "Tipo"]
    : ["Concepto", "Monto", "Descuento", "Tipo"];
  const conceptRows = items.map((item) => {
    const row = [
      item.payment_plan_concepts?.payment_concepts?.name || "—",
      `${fmt(item.amount_ves)} VES`,
      Number(item.discount_amount_ves) > 0 ? `${fmt(item.discount_amount_ves)} VES` : "—",
      item.is_partial ? "Parcial" : "Completo",
    ];
    if (!withStudentColumn) return row;
    const studentId = item.student_id ?? payment.student_id ?? "";
    return [studentNameById?.[studentId] || "—", ...row];
  });
  autoTable(doc, { startY: y + 3, head: [conceptHead], body: conceptRows, theme: "grid" });

  const methodRows = entries.map((m) => [
    methodLabel(m.method || ""),
    m.currency || "—",
    fmt(m.amount_original),
    String(m.exchange_rate ?? "—"),
    `${fmt(m.amount_ves)} VES`,
    m.reference_code || "—",
  ]);
  const afterConcepts = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 100;
  autoTable(doc, {
    startY: afterConcepts + 10,
    head: [["Método", "Moneda", "Monto Orig.", "Tasa", "Monto VES", "Ref."]],
    body: methodRows,
    theme: "grid",
  });

  const afterMethods = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 150;
  doc.setFontSize(12);
  doc.text(`Total: ${fmt(payment.total_amount_ves)} VES`, 14, afterMethods + 15);

  // Los descuentos no son ingreso, pero explican por qué la cuota quedó saldada
  const discountTotal = items.reduce((s, it) => s + (Number(it.discount_amount_ves) || 0), 0);
  if (discountTotal > 0) {
    const reasons = Array.from(new Set(
      items.filter((it) => Number(it.discount_amount_ves) > 0 && it.discount_reason)
        .map((it) => it.discount_reason as string),
    ));
    doc.setFontSize(10);
    doc.text(`Descuentos otorgados: ${fmt(discountTotal)} VES`, 14, afterMethods + 22);
    if (reasons.length > 0) doc.text(`Motivo: ${reasons.join(" · ")}`, 14, afterMethods + 28);
  }

  const suffix = payment.invoice_number?.trim() || payment.id.slice(0, 8);
  doc.save(`recibo_${suffix}.pdf`);
}
