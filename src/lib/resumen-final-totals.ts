import type { TableCell, TableRow } from "docx";
import type {
  ResumenFinalDocxData,
  SubjectAreaTotals,
} from "@/hooks/useResumenFinalDocxData";

/** Filas del bloque "Total de Áreas de Formación". */
export const TOTAL_AREA_ROW_COUNT = 6;

type TotalRowKey = keyof SubjectAreaTotals;

const TOTAL_ROWS: { label: string; key: TotalRowKey }[] = [
  { label: "Inscritos", key: "inscritos" },
  { label: "Inasistentes", key: "inasistentes" },
  { label: "Asistentes", key: "asistentes" },
  { label: "Aprobados", key: "aprobados" },
  { label: "No Aprobados", key: "noAprobados" },
  { label: "No Cursantes", key: "noCursantes" },
];

export type TotalsSheetLayout = {
  stIiiCols: number[];
  stIvCols: number[];
  nRegular: number;
  nProductive: number;
  ivGpIndex?: number;
  ivGrupoIndex?: number;
};

export type BuildTotalRowsDeps = {
  iiiSpanW: (layout: TotalsSheetLayout, start: number, count: number) => number;
  padTotal: (n: number) => string;
  mkStHdrRow: (cells: TableCell[], minHeight: number) => TableRow;
  mkStHdrCell: (
    w: number,
    text: string,
    opts?: { rowSpan?: number; columnSpan?: number },
  ) => TableCell;
  rowH: (baseHeight: number) => number;
  footTotalRowH: number;
};

export function buildTotalRows(
  data: ResumenFinalDocxData,
  layout: TotalsSheetLayout,
  deps: BuildTotalRowsDeps,
): TableRow[] {
  const titleW = deps.iiiSpanW(layout, 0, 3);
  const labelW = deps.iiiSpanW(layout, 3, 7);
  const nRegular = data.regularSubjects.length;

  return TOTAL_ROWS.map((item, i) =>
    deps.mkStHdrRow(
      [
        ...(i === 0
          ? [
              deps.mkStHdrCell(titleW, "Total de Áreas de Formación", {
                rowSpan: TOTAL_AREA_ROW_COUNT,
                columnSpan: 3,
              }),
            ]
          : []),
        deps.mkStHdrCell(labelW, item.label, { columnSpan: 7 }),
        ...data.regularSubjects.map((s, idx) =>
          deps.mkStHdrCell(
            layout.stIvCols[idx],
            deps.padTotal(data.subjectTotals[s.assignmentId]?.[item.key] ?? 0),
          ),
        ),
        ...data.productiveSubjects.map((s, idx) =>
          deps.mkStHdrCell(
            layout.stIvCols[nRegular + idx],
            deps.padTotal(data.subjectTotals[s.assignmentId]?.[item.key] ?? 0),
          ),
        ),
        ...(layout.ivGpIndex !== undefined && layout.ivGrupoIndex !== undefined
          ? [
              deps.mkStHdrCell(layout.stIvCols[layout.ivGpIndex], ""),
              deps.mkStHdrCell(layout.stIvCols[layout.ivGrupoIndex], ""),
            ]
          : []),
      ],
      deps.rowH(deps.footTotalRowH),
    ),
  );
}
