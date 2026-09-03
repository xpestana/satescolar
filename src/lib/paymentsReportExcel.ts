// Exportación a Excel del Reporte de Pagos.
// Usa xlsx-js-style (fork de SheetJS con estilos), igual que `incomesExcel.ts`; el `xlsx`
// community no colorea celdas.

import * as XLSX from "xlsx-js-style";
import { formatDateOnly } from "@/lib/dateUtils";
import { ROW_KIND_LABELS, type PaymentReportRow, type PaymentsReportTotals } from "@/lib/paymentsReport";

export interface PaymentsReportExcelMeta {
  schoolName?: string;
  yearLabel?: string;
  /** Texto de los filtros aplicados, o "Sin filtros" cuando se exporta todo. */
  filtersLabel?: string;
}

const HEADERS = [
  "N° Factura", "N° Control", "Fecha", "Tipo", "Estado",
  "Estudiante", "Cédula", "Grado / Sección", "Familia",
  "Plan", "Concepto", "Tipo de concepto",
  "Moneda", "Monto original", "Monto (VES)", "Descuento (VES)", "Motivo del descuento",
  "Exonerado (VES)", "Motivo de la exoneración", "Cobertura",
  "Total factura (VES)", "Métodos", "Banco", "Referencia", "Moneda del pago",
  "Titular", "RIF / C.I.", "Observaciones",
];
const COL_COUNT = HEADERS.length;
/** Columnas numéricas (índice 0-based), para formato y totales. */
const NUM_COLS = [13, 14, 15, 17, 20];
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

const statusLabel = (status: string) => (status === "voided" ? "Anulado" : "Completado");

export function exportPaymentsReportExcel(
  rows: PaymentReportRow[],
  totals: PaymentsReportTotals,
  meta: PaymentsReportExcelMeta,
  filename: string,
): void {
  const aoa: (string | number)[][] = [];
  const blank = () => Array(COL_COUNT).fill("") as (string | number)[];

  const titleRow = blank(); titleRow[0] = "Reporte de Pagos"; aoa.push(titleRow);
  const metaRow = blank();
  metaRow[0] = [
    meta.schoolName,
    meta.yearLabel,
    meta.filtersLabel,
    `${totals.rows} línea(s) · ${totals.payments} factura(s)`,
  ].filter(Boolean).join("   ·   ");
  aoa.push(metaRow);

  const headerRowIdx = aoa.length;
  aoa.push([...HEADERS]);

  const dataStartIdx = aoa.length;
  rows.forEach((r) => {
    aoa.push([
      r.invoiceNumber || "—",
      r.controlNumber || "—",
      r.paymentDate ? formatDateOnly(r.paymentDate) : "—",
      ROW_KIND_LABELS[r.kind],
      statusLabel(r.status),
      r.studentName || "—",
      r.studentDocument || "—",
      r.gradeLabel || "—",
      r.familyName || "—",
      r.planName || "—",
      r.conceptName || "—",
      r.conceptType || "—",
      r.conceptCurrency || "VES",
      r.originalAmount ?? "",
      r.amountVes || 0,
      r.discountVes || 0,
      r.discountReason || "",
      r.exoneratedVes || 0,
      r.exonerationReason || "",
      r.kind === "cuota" ? (r.isPartial ? "Parcial" : "Completo") : "—",
      r.paymentTotalVes || 0,
      r.methodsLabel || "—",
      r.banks || "—",
      r.references || "—",
      r.paymentCurrencies || "—",
      r.holderName || "—",
      r.holderDocument || "—",
      r.observations || "",
    ]);
  });

  const totalsRowIdx = aoa.length;
  const totalsRow = blank();
  totalsRow[0] = "TOTALES";
  totalsRow[14] = totals.amountVes;
  totalsRow[15] = totals.discountVes;
  totalsRow[17] = totals.exoneratedVes;
  aoa.push(totalsRow);

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  ws["!cols"] = [
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 28 }, { wch: 14 }, { wch: 18 }, { wch: 24 },
    { wch: 18 }, { wch: 22 }, { wch: 16 },
    { wch: 9 }, { wch: 14 }, { wch: 15 }, { wch: 15 }, { wch: 26 },
    { wch: 15 }, { wch: 26 }, { wch: 11 },
    { wch: 17 }, { wch: 24 }, { wch: 22 }, { wch: 16 }, { wch: 14 },
    { wch: 26 }, { wch: 14 }, { wch: 30 },
  ];
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: COL_COUNT - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: COL_COUNT - 1 } },
  ];
  // Encabezado congelado: el reporte suele tener cientos de líneas
  ws["!freeze"] = { xSplit: 0, ySplit: headerRowIdx + 1 };

  const setStyle = (r: number, c: number, style: Style) => {
    const ref = XLSX.utils.encode_cell({ r, c });
    if (!ws[ref]) ws[ref] = { t: "s", v: "" };
    ws[ref].s = { ...(ws[ref].s || {}), ...style };
  };

  for (let c = 0; c < COL_COUNT; c++) {
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
    setStyle(totalsRowIdx, c, {
      fill: { fgColor: { rgb: COLORS.totalsFill } },
      font: { bold: true, color: { rgb: COLORS.totalsFont } },
      border: box(COLORS.grid),
      ...(NUM_COLS.includes(c) ? { numFmt: NUM_FMT, alignment: { horizontal: "right" } } : {}),
    });
  }

  for (let r = dataStartIdx; r < totalsRowIdx; r++) {
    for (let c = 0; c < COL_COUNT; c++) {
      setStyle(r, c, {
        border: box(COLORS.grid),
        ...(NUM_COLS.includes(c) ? { numFmt: NUM_FMT, alignment: { horizontal: "right" } } : {}),
      });
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Pagos");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
