// Exportación a Excel del Reporte de Pagos.
// Usa xlsx-js-style (fork de SheetJS con estilos), igual que `incomesExcel.ts`; el `xlsx`
// community no colorea celdas.
//
// Dos hojas: "Facturas" (una fila por factura, lo mismo que se ve en pantalla) y
// "Detalle por cuota" (una fila por concepto/estudiante), para poder tabular en Excel sin
// perder el desglose.

import * as XLSX from "xlsx-js-style";
import { formatDateOnly } from "@/lib/dateUtils";
import { ROW_KIND_LABELS, type PaymentReportRow, type PaymentsReportTotals } from "@/lib/paymentsReport";

export interface PaymentsReportExcelMeta {
  schoolName?: string;
  yearLabel?: string;
  /** Texto de los filtros aplicados, o "Sin filtros" cuando se exporta todo. */
  filtersLabel?: string;
}

const INVOICE_HEADERS = [
  "N° Factura", "N° Control", "Fecha", "Estado", "Familia", "Titular", "RIF / C.I.",
  "Estudiantes", "Grados / Secciones", "Planes", "Conceptos", "N° de conceptos",
  "Cobrado (VES)", "Total factura (VES)", "Descuento (VES)", "Exonerado (VES)",
  "Métodos", "Banco", "Referencia", "Moneda del pago", "Observaciones",
];
const INVOICE_NUM_COLS = [12, 13, 14, 15];

const DETAIL_HEADERS = [
  "N° Factura", "Fecha", "Tipo", "Estudiante", "Grado / Sección", "Plan",
  "Concepto", "Tipo de concepto", "Moneda", "Monto original",
  "Monto (VES)", "Descuento (VES)", "Motivo del descuento",
  "Exonerado (VES)", "Motivo de la exoneración", "Cobertura",
];
const DETAIL_NUM_COLS = [9, 10, 11, 13];

const NUM_FMT = "#,##0.00";

const COLORS = {
  title: "1F4E78",
  titleFont: "FFFFFF",
  header: "2E75B6",
  headerFont: "FFFFFF",
  totalsFill: "FFF2CC",
  totalsFont: "7F6000",
  grid: "BFBFBF",
};

const thin = (rgb: string) => ({ style: "thin", color: { rgb } });
const box = (rgb: string) => ({ top: thin(rgb), bottom: thin(rgb), left: thin(rgb), right: thin(rgb) });

type Style = Record<string, unknown>;
type Cell = string | number;

const statusLabel = (status: string) => (status === "voided" ? "Anulado" : "Completado");

/** Aplica título, encabezado, bordes y formato numérico a una hoja ya construida. */
function styleSheet(
  ws: XLSX.WorkSheet,
  options: { colCount: number; headerRowIdx: number; dataStartIdx: number; dataEndIdx: number; numCols: number[]; totalsRowIdx?: number },
) {
  const { colCount, headerRowIdx, dataStartIdx, dataEndIdx, numCols, totalsRowIdx } = options;
  const setStyle = (r: number, c: number, style: Style) => {
    const ref = XLSX.utils.encode_cell({ r, c });
    if (!ws[ref]) ws[ref] = { t: "s", v: "" };
    ws[ref].s = { ...(ws[ref].s || {}), ...style };
  };

  for (let c = 0; c < colCount; c++) {
    setStyle(0, c, {
      fill: { fgColor: { rgb: COLORS.title } },
      font: { bold: true, sz: 14, color: { rgb: COLORS.titleFont } },
      alignment: { horizontal: "center", vertical: "center" },
    });
    setStyle(1, c, { font: { italic: true, sz: 10 }, alignment: { horizontal: "center" } });
    setStyle(headerRowIdx, c, {
      fill: { fgColor: { rgb: COLORS.header } },
      font: { bold: true, color: { rgb: COLORS.headerFont } },
      alignment: { horizontal: "center", wrapText: true },
      border: box(COLORS.grid),
    });
    if (totalsRowIdx != null) {
      setStyle(totalsRowIdx, c, {
        fill: { fgColor: { rgb: COLORS.totalsFill } },
        font: { bold: true, color: { rgb: COLORS.totalsFont } },
        border: box(COLORS.grid),
        ...(numCols.includes(c) ? { numFmt: NUM_FMT, alignment: { horizontal: "right" } } : {}),
      });
    }
  }

  for (let r = dataStartIdx; r < dataEndIdx; r++) {
    for (let c = 0; c < colCount; c++) {
      setStyle(r, c, {
        border: box(COLORS.grid),
        ...(numCols.includes(c) ? { numFmt: NUM_FMT, alignment: { horizontal: "right" } } : {}),
      });
    }
  }

  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } },
  ];
  // Encabezado congelado: el reporte suele tener cientos de filas
  ws["!freeze"] = { xSplit: 0, ySplit: headerRowIdx + 1 };
}

function buildInvoicesSheet(rows: PaymentReportRow[], totals: PaymentsReportTotals, meta: PaymentsReportExcelMeta) {
  const colCount = INVOICE_HEADERS.length;
  const blank = () => Array(colCount).fill("") as Cell[];
  const aoa: Cell[][] = [];

  const titleRow = blank(); titleRow[0] = "Reporte de Pagos"; aoa.push(titleRow);
  const metaRow = blank();
  metaRow[0] = [
    meta.schoolName, meta.yearLabel, meta.filtersLabel,
    `${totals.payments} factura(s) · ${totals.lines} concepto(s)`,
  ].filter(Boolean).join("   ·   ");
  aoa.push(metaRow);

  const headerRowIdx = aoa.length;
  aoa.push([...INVOICE_HEADERS]);

  const dataStartIdx = aoa.length;
  rows.forEach((r) => {
    aoa.push([
      r.invoiceNumber || "—",
      r.controlNumber || "—",
      r.paymentDate ? formatDateOnly(r.paymentDate) : "—",
      statusLabel(r.status),
      r.familyName || "—",
      r.holderName || "—",
      r.holderDocument || "—",
      r.studentNames.join(" / ") || "—",
      r.gradesLabel || "—",
      r.plansLabel || "—",
      r.conceptsLabel || "—",
      r.lines.length,
      r.amountVes || 0,
      r.paymentTotalVes || 0,
      r.discountVes || 0,
      r.exoneratedVes || 0,
      r.methodsLabel || "—",
      r.banks || "—",
      r.references || "—",
      r.paymentCurrencies || "—",
      r.observations || "",
    ]);
  });

  const totalsRowIdx = aoa.length;
  const totalsRow = blank();
  totalsRow[0] = "TOTALES";
  totalsRow[12] = totals.amountVes;
  totalsRow[14] = totals.discountVes;
  totalsRow[15] = totals.exoneratedVes;
  aoa.push(totalsRow);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 12 }, { wch: 13 }, { wch: 12 }, { wch: 12 }, { wch: 24 }, { wch: 26 }, { wch: 14 },
    { wch: 34 }, { wch: 22 }, { wch: 18 }, { wch: 40 }, { wch: 8 },
    { wch: 15 }, { wch: 17 }, { wch: 15 }, { wch: 15 },
    { wch: 24 }, { wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 30 },
  ];
  styleSheet(ws, { colCount, headerRowIdx, dataStartIdx, dataEndIdx: totalsRowIdx, numCols: INVOICE_NUM_COLS, totalsRowIdx });
  return ws;
}

function buildDetailSheet(rows: PaymentReportRow[], meta: PaymentsReportExcelMeta) {
  const colCount = DETAIL_HEADERS.length;
  const blank = () => Array(colCount).fill("") as Cell[];
  const aoa: Cell[][] = [];

  const titleRow = blank(); titleRow[0] = "Detalle por cuota"; aoa.push(titleRow);
  const metaRow = blank();
  metaRow[0] = [meta.schoolName, meta.yearLabel, meta.filtersLabel].filter(Boolean).join("   ·   ");
  aoa.push(metaRow);

  const headerRowIdx = aoa.length;
  aoa.push([...DETAIL_HEADERS]);

  const dataStartIdx = aoa.length;
  rows.forEach((r) => {
    r.lines.forEach((line) => {
      aoa.push([
        r.invoiceNumber || "—",
        r.paymentDate ? formatDateOnly(r.paymentDate) : "—",
        ROW_KIND_LABELS[line.kind],
        line.studentName || "—",
        line.gradeLabel || "—",
        line.planName || "—",
        line.conceptName || "—",
        line.conceptType || "—",
        line.conceptCurrency || "VES",
        line.originalAmount ?? "",
        line.amountVes || 0,
        line.discountVes || 0,
        line.discountReason || "",
        line.exoneratedVes || 0,
        line.exonerationReason || "",
        line.kind === "cuota" ? (line.isPartial ? "Parcial" : "Completo") : "—",
      ]);
    });
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 12 }, { wch: 12 }, { wch: 13 }, { wch: 28 }, { wch: 18 }, { wch: 18 },
    { wch: 24 }, { wch: 16 }, { wch: 9 }, { wch: 14 },
    { wch: 15 }, { wch: 15 }, { wch: 26 }, { wch: 15 }, { wch: 26 }, { wch: 11 },
  ];
  styleSheet(ws, { colCount, headerRowIdx, dataStartIdx, dataEndIdx: aoa.length, numCols: DETAIL_NUM_COLS });
  return ws;
}

export function exportPaymentsReportExcel(
  rows: PaymentReportRow[],
  totals: PaymentsReportTotals,
  meta: PaymentsReportExcelMeta,
  filename: string,
): void {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildInvoicesSheet(rows, totals, meta), "Facturas");
  XLSX.utils.book_append_sheet(wb, buildDetailSheet(rows, meta), "Detalle por cuota");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
