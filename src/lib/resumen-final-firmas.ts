import {
  AlignmentType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  WidthType,
  VerticalAlign,
  type ITableBordersOptions,
} from "docx";
import type { ResumenFinalDocxData } from "@/hooks/useResumenFinalDocxData";

export const FOOT_SIG_ROW_H = 290;
export const FOOT_SIG_SEAL_H = 890;

const SELLO_INSTITUCION = "SELLO DE LA INSTITUCIÓN EDUCATIVA";
const SELLO_ZONA = "SELLO DE LA ZONA EDUCATIVA";

export type BuildFirmasDeps = {
  rowH: (baseHeight: number, minHeight?: number) => number;
  mkStHdrRow: (cells: TableCell[], minHeight: number) => TableRow;
  mkSigCell: (
    w: number,
    text: string,
    opts?: { bold?: boolean; rowSpan?: number },
  ) => TableCell;
  mkSigSealCell: (w: number, text: string, rowSpan: number) => TableCell;
  remisionDateFromYearRange: (yearRange: string) => string;
  bordersGrid: ITableBordersOptions;
};

export function buildFirmasBlock(
  data: ResumenFinalDocxData,
  tableW: number,
  deps: BuildFirmasDeps,
): Table {
  const h = data.schoolHeader;
  const remision = deps.remisionDateFromYearRange(data.yearRange);
  const director = (h.director ?? "").toUpperCase();
  const cedulaDir = h.cedula_director ?? "";
  const c1 = Math.round(tableW * 0.22);
  const c2 = Math.round(tableW * 0.2);
  const c3 = Math.round(tableW * 0.35);
  const c4 = tableW - c1 - c2 - c3;
  const cols = [c1, c2, c3, c4];

  return new Table({
    width: { size: tableW, type: WidthType.DXA },
    columnWidths: cols,
    layout: TableLayoutType.FIXED,
    borders: deps.bordersGrid,
    rows: [
      deps.mkStHdrRow(
        [
          deps.mkSigCell(cols[0], `VIII. Fecha de Remisión: ${remision}`, {
            bold: true,
          }),
          deps.mkSigSealCell(cols[1], SELLO_INSTITUCION, 7),
          deps.mkSigCell(cols[2], "IX. Fecha de Recepción:", { bold: true }),
          deps.mkSigSealCell(cols[3], SELLO_ZONA, 7),
        ],
        deps.rowH(FOOT_SIG_ROW_H),
      ),
      deps.mkStHdrRow(
        [
          deps.mkSigCell(cols[0], "Director(a)"),
          deps.mkSigCell(cols[2], "Funcionario Receptor"),
        ],
        deps.rowH(FOOT_SIG_ROW_H),
      ),
      deps.mkStHdrRow(
        [
          deps.mkSigCell(cols[0], "Apellidos y Nombres:"),
          deps.mkSigCell(cols[2], "Apellidos y Nombres:"),
        ],
        deps.rowH(FOOT_SIG_ROW_H),
      ),
      deps.mkStHdrRow(
        [
          deps.mkSigCell(cols[0], director),
          deps.mkSigCell(cols[2], ""),
        ],
        deps.rowH(FOOT_SIG_ROW_H),
      ),
      deps.mkStHdrRow(
        [
          deps.mkSigCell(cols[0], "Cédula de Identidad"),
          deps.mkSigCell(cols[2], "Cédula de Identidad"),
        ],
        deps.rowH(FOOT_SIG_ROW_H),
      ),
      deps.mkStHdrRow(
        [
          deps.mkSigCell(cols[0], cedulaDir),
          deps.mkSigCell(cols[2], ""),
        ],
        deps.rowH(FOOT_SIG_ROW_H),
      ),
      deps.mkStHdrRow(
        [
          deps.mkSigCell(cols[0], "Firma:"),
          deps.mkSigCell(cols[2], "Firma:"),
        ],
        deps.rowH(FOOT_SIG_SEAL_H, 400),
      ),
    ],
  });
}
