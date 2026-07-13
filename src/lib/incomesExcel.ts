// Excel export for the "Detalle de Pagos" table (Ingresos report).
// Uses xlsx-js-style (drop-in SheetJS fork) so cells can carry fills/fonts/borders,
// which the community `xlsx` build does not support.

import * as XLSX from "xlsx-js-style";
import { formatDateOnly } from "@/lib/dateUtils";

export interface IncomeExcelRow {
  operacion: number;
  fecha: string;
  rif: string;
  nombre: string;
  factura: string;
  control: string;
  total: number;
  mensualidad: number;
  inscripcion: number;
  seguro: number;
  otros: number;
}

export interface IncomeTotals {
  total: number;
  mensualidad: number;
  inscripcion: number;
  seguro: number;
  otros: number;
}

export interface IncomeExcelMeta {
  schoolName?: string;
  yearLabel?: string;
  monthLabel?: string;
}

const HEADERS = [
  "N°", "Fecha", "RIF", "Nombre / Razón Social", "N° Factura", "N° Control",
  "Total Ingresos", "Mensualidad", "Inscripción", "Seguro Escolar", "Otros",
];
const COL_COUNT = HEADERS.length;
const NUM_COLS = [6, 7, 8, 9, 10];
const NUM_FMT = "#,##0.00";

// Palette (Excel-friendly hex RGB).
const COLORS = {
  title: "1F4E78",
  titleFont: "FFFFFF",
  header: "2E75B6",
  headerFont: "FFFFFF",
  totalsFill: "FFF2CC",
  totalsFont: "7F6000",
  sumTitle: "1F4E78",
  sumLabel: "D9E1F2",
  sumValue: "E2EFDA",
  sumFont: "1F3864",
  gridLight: "E0E0E0",
  grid: "BFBFBF",
};

const thin = (rgb: string) => ({ style: "thin", color: { rgb } });
const box = (rgb: string) => ({ top: thin(rgb), bottom: thin(rgb), left: thin(rgb), right: thin(rgb) });

type Style = Record<string, unknown>;

export function exportIncomesExcel(
  rows: IncomeExcelRow[],
  totals: IncomeTotals,
  meta: IncomeExcelMeta,
  filename: string,
): void {
  const aoa: (string | number)[][] = [];
  const blank = () => Array(COL_COUNT).fill("") as (string | number)[];

  // Title + meta
  const titleRow = blank(); titleRow[0] = "Detalle de Pagos"; aoa.push(titleRow);
  const metaRow = blank();
  metaRow[0] = [meta.schoolName, meta.yearLabel, meta.monthLabel, `${rows.length} registro(s)`]
    .filter(Boolean).join("   ·   ");
  aoa.push(metaRow);

  // Header
  const headerRowIdx = aoa.length;
  aoa.push([...HEADERS]);

  // Data
  const dataStartIdx = aoa.length;
  rows.forEach((r) => {
    aoa.push([
      r.operacion,
      r.fecha ? formatDateOnly(r.fecha) : "—",
      r.rif || "—",
      r.nombre || "—",
      r.factura || "—",
      r.control || "—",
      r.total || 0,
      r.mensualidad || 0,
      r.inscripcion || 0,
      r.seguro || 0,
      r.otros || 0,
    ]);
  });

  // Totals row (a total printed under each numeric column)
  const totalsRowIdx = aoa.length;
  const totalsRow = blank();
  totalsRow[0] = "TOTALES";
  totalsRow[6] = totals.total;
  totalsRow[7] = totals.mensualidad;
  totalsRow[8] = totals.inscripcion;
  totalsRow[9] = totals.seguro;
  totalsRow[10] = totals.otros;
  aoa.push(totalsRow);

  // Blank separator
  aoa.push(blank());

  // Vertical, centered summary of totals
  const sumTitleIdx = aoa.length;
  const sumTitleRow = blank(); sumTitleRow[4] = "RESUMEN DE TOTALES"; aoa.push(sumTitleRow);
  const sumConcepts: [string, number][] = [
    ["Total Ingresos", totals.total],
    ["Mensualidad", totals.mensualidad],
    ["Inscripción", totals.inscripcion],
    ["Seguro Escolar", totals.seguro],
    ["Otros", totals.otros],
  ];
  const sumStartIdx = aoa.length;
  sumConcepts.forEach(([label, value]) => {
    const row = blank();
    row[4] = label;
    row[6] = value;
    aoa.push(row);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  ws["!cols"] = [
    { wch: 5 }, { wch: 12 }, { wch: 13 }, { wch: 30 }, { wch: 12 }, { wch: 12 },
    { wch: 16 }, { wch: 14 }, { wch: 13 }, { wch: 15 }, { wch: 12 },
  ];

  const setStyle = (r: number, c: number, s: Style) => {
    const addr = XLSX.utils.encode_cell({ r, c });
    if (!ws[addr]) ws[addr] = { t: "s", v: "" };
    ws[addr].s = s;
  };

  // Merges: title, meta, totals label, summary title + each concept (label/value)
  const merges: XLSX.Range[] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: COL_COUNT - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: COL_COUNT - 1 } },
    { s: { r: totalsRowIdx, c: 0 }, e: { r: totalsRowIdx, c: 5 } },
    { s: { r: sumTitleIdx, c: 4 }, e: { r: sumTitleIdx, c: 7 } },
  ];
  sumConcepts.forEach((_, i) => {
    const r = sumStartIdx + i;
    merges.push({ s: { r, c: 4 }, e: { r, c: 5 } });
    merges.push({ s: { r, c: 6 }, e: { r, c: 7 } });
  });
  ws["!merges"] = merges;

  // Title / meta
  setStyle(0, 0, {
    font: { bold: true, sz: 14, color: { rgb: COLORS.titleFont } },
    fill: { patternType: "solid", fgColor: { rgb: COLORS.title } },
    alignment: { horizontal: "center", vertical: "center" },
  });
  setStyle(1, 0, {
    font: { italic: true, sz: 10, color: { rgb: "595959" } },
    alignment: { horizontal: "center", vertical: "center" },
  });

  // Header
  for (let c = 0; c < COL_COUNT; c++) {
    setStyle(headerRowIdx, c, {
      font: { bold: true, sz: 11, color: { rgb: COLORS.headerFont } },
      fill: { patternType: "solid", fgColor: { rgb: COLORS.header } },
      alignment: {
        horizontal: NUM_COLS.includes(c) ? "right" : c === 0 ? "center" : "left",
        vertical: "center",
        wrapText: true,
      },
      border: box(COLORS.grid),
    });
  }

  // Data cells
  for (let i = 0; i < rows.length; i++) {
    const r = dataStartIdx + i;
    for (let c = 0; c < COL_COUNT; c++) {
      const isNum = NUM_COLS.includes(c);
      const s: Style = {
        font: { sz: 10 },
        alignment: { horizontal: isNum ? "right" : c === 0 ? "center" : "left", vertical: "center" },
        border: box(COLORS.gridLight),
      };
      if (isNum) (s as any).numFmt = NUM_FMT;
      setStyle(r, c, s);
    }
  }

  // Totals row (colored under each column)
  for (let c = 0; c <= 5; c++) {
    setStyle(totalsRowIdx, c, {
      font: { bold: true, sz: 11, color: { rgb: COLORS.totalsFont } },
      fill: { patternType: "solid", fgColor: { rgb: COLORS.totalsFill } },
      alignment: { horizontal: "right", vertical: "center" },
      border: box(COLORS.grid),
    });
  }
  NUM_COLS.forEach((c) => {
    setStyle(totalsRowIdx, c, {
      font: { bold: true, sz: 11, color: { rgb: COLORS.totalsFont } },
      fill: { patternType: "solid", fgColor: { rgb: COLORS.totalsFill } },
      alignment: { horizontal: "right", vertical: "center" },
      border: box(COLORS.grid),
      numFmt: NUM_FMT,
    });
  });

  // Summary: title + concept rows (label + value), centered, colored
  setStyle(sumTitleIdx, 4, {
    font: { bold: true, sz: 12, color: { rgb: COLORS.titleFont } },
    fill: { patternType: "solid", fgColor: { rgb: COLORS.sumTitle } },
    alignment: { horizontal: "center", vertical: "center" },
    border: box(COLORS.grid),
  });
  sumConcepts.forEach((_, i) => {
    const r = sumStartIdx + i;
    setStyle(r, 4, {
      font: { bold: true, sz: 11, color: { rgb: COLORS.sumFont } },
      fill: { patternType: "solid", fgColor: { rgb: COLORS.sumLabel } },
      alignment: { horizontal: "center", vertical: "center" },
      border: box(COLORS.grid),
    });
    setStyle(r, 6, {
      font: { bold: true, sz: 11, color: { rgb: COLORS.sumFont } },
      fill: { patternType: "solid", fgColor: { rgb: COLORS.sumValue } },
      alignment: { horizontal: "center", vertical: "center" },
      border: box(COLORS.grid),
      numFmt: NUM_FMT,
    });
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Ingresos");
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}
