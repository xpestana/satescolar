// Exportación a Excel de la Estadística de matrícula.
// Usa xlsx-js-style (como `paymentsReportExcel.ts`) para reproducir el formato del cuadro oficial:
// bloques por sección en una cuadrícula de 3 columnas, con título, encabezado y totales coloreados.

import * as XLSX from "xlsx-js-style";
import type { EnrollmentStatsExportMeta, EnrollmentStatsSheet, ReportCell, ReportTable } from "./reportTables";

const TABLES_PER_ROW = 3;
const GAP_COLUMNS = 1;

const COLORS = {
  title: "1F4E78",
  titleFont: "FFFFFF",
  blockTitle: "D9D2E9",
  blockTitleFont: "1F3A93",
  header: "EDEDED",
  totalsFill: "FFF2CC",
  grid: "BFBFBF",
};

type Style = Record<string, unknown>;

const thin = (rgb: string) => ({ style: "thin", color: { rgb } });
const box = (rgb: string) => ({ top: thin(rgb), bottom: thin(rgb), left: thin(rgb), right: thin(rgb) });

class SheetCanvas {
  readonly aoa: ReportCell[][] = [];
  readonly styles: { r: number; c: number; style: Style }[] = [];
  readonly merges: XLSX.Range[] = [];

  put(r: number, c: number, value: ReportCell, style?: Style) {
    while (this.aoa.length <= r) this.aoa.push([]);
    const row = this.aoa[r];
    while (row.length <= c) row.push("");
    row[c] = value;
    if (style) this.styles.push({ r, c, style });
  }
}

/** Draws one table at (row, col) and returns how many rows it used. */
function drawTable(canvas: SheetCanvas, table: ReportTable, row: number, col: number): number {
  const width = table.head.length;
  const cellStyle = (extra: Style = {}): Style => ({
    border: box(COLORS.grid),
    alignment: { horizontal: "center", vertical: "center" },
    ...extra,
  });

  for (let c = 0; c < width; c++) {
    canvas.put(row, col + c, c === 0 ? table.title : "", cellStyle({
      fill: { fgColor: { rgb: COLORS.blockTitle } },
      font: { bold: true, color: { rgb: COLORS.blockTitleFont } },
    }));
  }
  canvas.merges.push({ s: { r: row, c: col }, e: { r: row, c: col + width - 1 } });

  table.head.forEach((label, c) =>
    canvas.put(row + 1, col + c, label, cellStyle({ fill: { fgColor: { rgb: COLORS.header } }, font: { bold: true } })),
  );
  let r = row + 2;
  table.body.forEach((cells) => {
    cells.forEach((value, c) => canvas.put(r, col + c, value, cellStyle()));
    r++;
  });
  table.foot.forEach((cells, i) => {
    cells.forEach((value, c) =>
      canvas.put(r, col + c, value, cellStyle({
        font: { bold: true },
        ...(i === 0 ? { fill: { fgColor: { rgb: COLORS.totalsFill } } } : {}),
        ...(c === 0 ? { alignment: { horizontal: "left" } } : {}),
      })),
    );
    r++;
  });
  return r - row;
}

function buildSheet(sheet: EnrollmentStatsSheet, meta: EnrollmentStatsExportMeta): XLSX.WorkSheet {
  const canvas = new SheetCanvas();
  const tableWidth = Math.max(4, ...sheet.tables.map((t) => t.head.length));
  const colCount = TABLES_PER_ROW * (tableWidth + GAP_COLUMNS) - GAP_COLUMNS;

  canvas.put(0, 0, sheet.title, {
    fill: { fgColor: { rgb: COLORS.title } },
    font: { bold: true, sz: 13, color: { rgb: COLORS.titleFont } },
    alignment: { horizontal: "center" },
  });
  canvas.put(1, 0, [meta.schoolName, meta.yearLabel, meta.scopeLabel, `Fecha de actualización: ${meta.dateLabel}`]
    .filter(Boolean).join("   ·   "), { font: { italic: true, sz: 10 }, alignment: { horizontal: "center" } });
  canvas.merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } });
  canvas.merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } });

  let row = 3;
  for (let i = 0; i < sheet.tables.length; i += TABLES_PER_ROW) {
    const heights = sheet.tables
      .slice(i, i + TABLES_PER_ROW)
      .map((table, j) => drawTable(canvas, table, row, j * (tableWidth + GAP_COLUMNS)));
    row += Math.max(...heights) + 1;
  }

  const ws = XLSX.utils.aoa_to_sheet(canvas.aoa);
  canvas.styles.forEach(({ r, c, style }) => {
    const ref = XLSX.utils.encode_cell({ r, c });
    if (ws[ref]) ws[ref].s = style;
  });
  ws["!merges"] = canvas.merges;
  ws["!cols"] = Array.from({ length: colCount }, (_, c) => {
    const inTable = c % (tableWidth + GAP_COLUMNS);
    if (inTable === tableWidth) return { wch: 3 };
    return { wch: inTable === 0 ? 16 : 7 };
  });
  return ws;
}

export function exportEnrollmentStatsExcel(
  sheets: EnrollmentStatsSheet[],
  meta: EnrollmentStatsExportMeta,
  filename: string,
): void {
  const wb = XLSX.utils.book_new();
  sheets
    .filter((sheet) => sheet.tables.length > 0)
    .forEach((sheet) => XLSX.utils.book_append_sheet(wb, buildSheet(sheet, meta), sheet.name));
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
