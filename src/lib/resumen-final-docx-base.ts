import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  SectionType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  UnderlineType,
  VerticalAlign,
  WidthType,
  HeightRule,
  VerticalMergeType,
} from "docx";
import type {
  ResumenFinalDocxData,
  StudentDocxRow,
} from "@/hooks/useResumenFinalDocxData";
import {
  buildTotalRows as buildAreaTotalRows,
  TOTAL_AREA_ROW_COUNT,
} from "@/lib/resumen-final-totals";
import {
  buildProfesoresCursoTable,
  computeColumnWidths,
  estimateProfesoresBlockHeight,
  estimateProfesoresWrapExtra,
  VI_START_AFTER_IV_COLS,
} from "@/lib/resumen-final-profesores-curso";
import {
  buildFirmasBlock,
  FOOT_SIG_ROW_H,
  FOOT_SIG_SEAL_H,
} from "@/lib/resumen-final-firmas";
import { GRADE_LABELS } from "@/lib/buildInvoiceData";
import { RF } from "@/lib/resumen-final-docx-labels";
import { formatPlanillaStudentText } from "@/lib/resumen-final-text";

export type ResumenFinalDocxVariant = {
  /** Solo planilla 31059 (sin menci?n): columnas GP + GRUPO para GCRP. */
  includeGpGrupo: boolean;
  /** URL del logo de cabecera (default: LOGO_URL de S3). */
  logoUrl?: string;
  /** Margen izquierdo del logo en twips (negativo desplaza a la izquierda). */
  logoMarginLeft?: number;
  /** Preserva Ñ y acentos al mayusculizar nombres/apellidos (planilla 31060). */
  useSpanishNames?: boolean;
  /** Ajustes de altura de página (solo planilla 31060). */
  pageLayoutExtra?: {
    /** Extra en estimación de cabecera (logo más alto, interlineado). */
    headerBlockExtra?: number;
    /** Margen extra al calcular altura final de hoja. */
    pageBufferExtra?: number;
    /** Estimar filas de profesores con texto multilínea. */
    profesoresWrapEstimate?: boolean;
  };
};

type LayoutEstimateOpts = {
  headerExtra?: number;
  profesoresWrapExtra?: number;
};

// ??? p?gina (estrategia UEH: hoja virtual alta; ancho din?mico seg?n materias IV) ??
const PAGE_H_MAX = 31660; // altura m?xima ~55.80 cm para escalar contenido
const PAGE_H_BUFFER = 80; // margen extra al ajustar altura real de p?gina
const cmToTwips = (cm: number) => Math.round((cm / 2.54) * 1440);
const MARGIN_LEFT = cmToTwips(0.8); // 0.8 cm
const MARGIN_RIGHT = cmToTwips(0.8); // 0.8 cm
const MARGIN_TOP = cmToTwips(0.8); // 0.8 cm
const MARGIN_BOTTOM = cmToTwips(0.8); // 0.8 cm
const PARA_SPACE_BEFORE = 8;
const HDR_BLOCK_GAP = 0; // espacio logo/cabecera ? secci?n II (usar mkCompactGap)
const ST_TABLE_GAP = 30; // espacio secci?n II ? tabla estudiantes

const PARA_SPACE_AFTER = 0;

// ??? cabecera ? ajustar aqu? ?????????????????????????????????????????
const LOGO_URL =
  "https://satescolar.s3.us-east-1.amazonaws.com/planillas/LOGO+ANTERIOR.png";
const LOGO_WIDTH_RATIO = 0.32;
const LOGO_MAX_HEIGHT_PX = 76; // limita altura logo ? evita hueco bajo punto I
const HDR_TITLE_INDENT = 200;
const HDR_FONT = "Arial";
const HDR_TITLE_SIZE = 9;
const HDR_BODY_SIZE = 9;
const HDR_LINE_SPACING = 220; // interlineado cabecera (+2 pt sobre 180)
const BODY_LABEL_SIZE = 9; // t?tulos / etiquetas
const BODY_DATA_SIZE = 10; // datos desde BD
const IE_LINE_SPACING = 185; // interlineado secci?n II
const IE_ROW_GAP = 34; // separaci?n vertical entre filas secci?n II
const IE_TITLE_PAD_TOP = 6; // padding interno celda t?tulo II (no el hueco bajo logo)
// ??? tabla III + IV (estudiantes) ? ajustar aqu? ?????????????????????
const ST_COL_III_FIXED = 11201; // III fijo ? no cambia con materias
const IV_MATERIA_W = 450; // ancho columna materia regular
const IV_PRODUCTIVE_W = 700; // ancho columna materia productiva (m?s ancho para encabezado)
const IV_GP_W = 700; // columna GP
const IV_GRUPO_W = 2250; // columna GRUPO (nombre del grupo GCRP)
const ST_TABLE_FONT_SIZE = 9; // Arial 9 ? cabeceras tabla III/IV
const ST_HDR_FONT_SIZE = ST_TABLE_FONT_SIZE;
const ST_CELL_PAD = 10;
const ST_TITLE_ROW_MIN = 340; // altura fila t?tulos III/IV
const ST_TITLE_PAD_TOP = 2;
const ST_TITLE_PAD_BOTTOM = 4;
// subcolumnas III (suma = ST_COL_III = 11201)
const ST_III_NRO = 472;
const ST_III_CED = 1845;
const ST_III_APE = 2287;
const ST_III_NOM = 2286;
const ST_III_LUG = 1801;
const ST_III_EF = 546;
const ST_III_SEX = 384;
const ST_III_DIA = 495;
const ST_III_MES = 495;
const ST_III_ANO = 590;
const ST_III_FECHA_W = 1580; // ST_III_DIA + ST_III_MES + ST_III_ANO
const ST_HDR_VERT_PAD_TOP = 6;
const ST_HDR_VERT_PAD_BOTTOM = 5;
const ST_HDR_VERT_LINE = 180; // ? altura Arial 9pt
const ST_HDR_CELL_PAD_TOP = 14; // aire arriba (N?, C?dula, etc.)
const ST_HDR_CELL_PAD_BOTTOM = 5;
const ST_HDR_MULTILINE_BEFORE = 7; // espacio 1? l?nea multil?nea
const ST_HDR_ROW1_MIN = 415; // altura m?n. fila N??Fecha de nacimiento (UEH: 415)
const ST_HDR_ROW2_MIN = 465; // altura m?n. fila DIA / MES / A?O (UEH: 465)
const ST_IV_HDR_ROW0 = 415; // t?tulo IV
const ST_IV_HDR_ROW1 = 465; // ?REAS DE FORMACI?N
const ST_IV_HDR_ROW2 = 415; // COMPONENTE GENERAL / COMPONENTE PRODUCTIVO
const ST_IV_HDR_ROW3 = 365; // n?meros 1?N
const ST_IV_HDR_ROW4 = 415; // siglas + GP
const III_HDR_ROW_SPAN = 4; // filas cabecera III (1?4) antes de datos
const FECHA_SUB_ROW_SPAN = 3; // DIA/MES/A?O cubren filas 2?4
// ??? pie de tabla (totales V?IX) ? UEH p?gina 40 ?????????????????????
const FOOT_TOTAL_ROW_H = 412;
const FOOT_OBS_H = 890;
const ST_III_COLS = [
  ST_III_NRO,
  ST_III_CED,
  ST_III_APE,
  ST_III_NOM,
  ST_III_LUG,
  ST_III_EF,
  ST_III_SEX,
  ST_III_DIA,
  ST_III_MES,
  ST_III_ANO,
];
const ST_ROWS_PER_PAGE = 35;
const ST_DATA_FONT_SIZE = BODY_DATA_SIZE; // Arial 10 ? datos desde BD en tabla III/IV
const ST_DATA_ROW_MIN = 412; // altura m?nima fila alumno (UEH: 412)
const ST_DATA_CELL_PAD = 0;
const ST_DATA_CELL_PAD_LEFT = 40; // padding izquierdo filas de datos
const ST_EMPTY = "***";
const ST_EMPTY_SHORT = "*"; // EF, SEXO, DIA, MES, A?O
const W_LBL_ANO = 1580;
const W_LBL_TIPO = 1800; // "Tipo de Evaluaci?n:" en una sola l?nea
const W_LINE_TIPO = 700; // l?nea corta solo para "Final"
const W_LBL_MES = 1500;
const W_LBL_COL0 = 1800; // columna 0 cabecera (? W_LBL_ANO y W_LBL_TIPO)

// Altura de referencia calibrada para ~9 materias en ?rea Com?n
const HEADER_BLOCK_ESTIMATE = 2000;
const INSTITUTION_BLOCK_ESTIMATE = 1400;
const V_SCALE_MIN = 0.72;
const V_SCALE_SAFETY = 0.985;

type SheetLayout = {
  pageW: number;
  pageH: number;
  contentW: number;
  vScale: number;
  stColIii: number;
  stColIv: number;
  stIiiCols: number[];
  stIvCols: number[];
  stAllCols: number[];
  stTableW: number;
  ieRowW: number;
  ieRowCols: number[];
  ieDirRowCols: number[];
  ieMunRowCols: number[];
  ieDirCedRowCols: number[];
  nRegular: number;
  nProductive: number;
  nIvCols: number;
  includeGpGrupo: boolean;
  useSpanishNames: boolean;
  tipoPlanilla: "31059" | "31060";
  logoMarginLeft: number;
  ivGpIndex?: number;
  ivGrupoIndex?: number;
};

function rowH(
  layout: SheetLayout,
  baseHeight: number,
  minHeight = 180,
): number {
  return Math.max(minHeight, Math.round(baseHeight * layout.vScale));
}

function estimateContentHeightTwips(
  nRegular: number,
  nProductive: number,
  includeGpGrupo: boolean,
  opts: LayoutEstimateOpts = {},
): number {
  const headerExtra = opts.headerExtra ?? 0;
  const profesoresWrapExtra = opts.profesoresWrapExtra ?? 0;
  return (
    HEADER_BLOCK_ESTIMATE +
    headerExtra +
    INSTITUTION_BLOCK_ESTIMATE +
    ST_TABLE_GAP +
    ST_TITLE_ROW_MIN +
    ST_IV_HDR_ROW1 +
    ST_IV_HDR_ROW2 +
    ST_IV_HDR_ROW3 +
    ST_IV_HDR_ROW4 +
    ST_ROWS_PER_PAGE * ST_DATA_ROW_MIN +
    TOTAL_AREA_ROW_COUNT * FOOT_TOTAL_ROW_H +
    estimateProfesoresBlockHeight(nRegular, nProductive, includeGpGrupo) +
    profesoresWrapExtra +
    FOOT_OBS_H +
    6 * FOOT_SIG_ROW_H +
    FOOT_SIG_SEAL_H
  );
}

function fixedLayoutHeightTwips(opts: LayoutEstimateOpts = {}): number {
  return (
    HEADER_BLOCK_ESTIMATE +
    (opts.headerExtra ?? 0) +
    INSTITUTION_BLOCK_ESTIMATE +
    ST_TABLE_GAP
  );
}

function estimateContentHeightAtScale(
  nRegular: number,
  nProductive: number,
  vScale: number,
  includeGpGrupo: boolean,
  opts: LayoutEstimateOpts = {},
): number {
  const fixed = fixedLayoutHeightTwips(opts);
  const total = estimateContentHeightTwips(
    nRegular,
    nProductive,
    includeGpGrupo,
    opts,
  );
  return fixed + Math.round((total - fixed) * vScale);
}

function computeVerticalScale(
  nRegular: number,
  nProductive: number,
  includeGpGrupo: boolean,
  opts: LayoutEstimateOpts = {},
): number {
  const usable = PAGE_H_MAX - MARGIN_TOP - MARGIN_BOTTOM;
  const fixed = fixedLayoutHeightTwips(opts);
  const total = estimateContentHeightTwips(
    nRegular,
    nProductive,
    includeGpGrupo,
    opts,
  );
  if (total <= usable) return 1;
  const scalable = total - fixed;
  if (scalable <= 0) return V_SCALE_MIN;
  const scale = ((usable - fixed) / scalable) * V_SCALE_SAFETY;
  return Math.max(V_SCALE_MIN, scale);
}

function distributeLineWidths(total: number, weights: number[]): number[] {
  const wSum = weights.reduce((a, b) => a + b, 0);
  const cols = weights.map((w) => Math.floor((total * w) / wSum));
  const diff = total - cols.reduce((a, b) => a + b, 0);
  cols[cols.length - 1] += diff;
  return cols;
}

function computeIeRowCols(contentW: number): number[] {
  const fixed = 2800 + 1600 + 500 + 1000;
  return [2800, 1600, 500, 1000, contentW - fixed];
}

function computeIeDirRowCols(contentW: number): number[] {
  const fixed = 900 + 300 + 900;
  const [lineDir, lineTel] = distributeLineWidths(
    contentW - fixed,
    [0.823, 0.177],
  );
  return [900, lineDir, 300, 900, lineTel];
}

function computeIeMunRowCols(contentW: number): number[] {
  const fixed = 1100 + 500 + 1500 + 500 + 1400;
  const lineTotal = contentW - fixed;
  const l1 = Math.floor(lineTotal / 3);
  const l2 = Math.floor(lineTotal / 3);
  const l3 = lineTotal - l1 - l2;
  return [1100, l1, 500, 1500, l2, 500, 1400, l3];
}

function computeIeDirCedRowCols(contentW: number): number[] {
  const fixed = 950 + 500 + 1600;
  const [lineDir, lineCed] = distributeLineWidths(
    contentW - fixed,
    [0.703, 0.297],
  );
  return [950, lineDir, 500, 1600, lineCed];
}

function computeSheetLayout(
  data: ResumenFinalDocxData,
  variant: ResumenFinalDocxVariant,
): SheetLayout {
  const nRegular = data.regularSubjects.length;
  const nProductive = data.productiveSubjects.length;
  const includeGpGrupo = variant.includeGpGrupo;
  const stIiiCols = [...ST_III_COLS];
  const stColIii = ST_COL_III_FIXED;
  const stIvCols = [
    ...Array(nRegular).fill(IV_MATERIA_W),
    ...Array(nProductive).fill(IV_PRODUCTIVE_W),
    ...(includeGpGrupo ? [IV_GP_W, IV_GRUPO_W] : []),
  ];
  const stColIv = stIvCols.reduce((a, b) => a + b, 0);

  const pageLayoutExtra = variant.pageLayoutExtra;
  let profesoresWrapExtra = 0;
  if (pageLayoutExtra?.profesoresWrapEstimate) {
    const { vCols } = computeColumnWidths(
      stColIii,
      stColIv,
      IV_MATERIA_W,
      stIvCols,
      VI_START_AFTER_IV_COLS,
    );
    profesoresWrapExtra = estimateProfesoresWrapExtra(
      [...data.regularSubjects, ...data.productiveSubjects],
      vCols[2],
      vCols[3],
    );
  }
  const estimateOpts: LayoutEstimateOpts = {
    headerExtra: pageLayoutExtra?.headerBlockExtra ?? 0,
    profesoresWrapExtra,
  };

  const vScale = computeVerticalScale(
    nRegular,
    nProductive,
    includeGpGrupo,
    estimateOpts,
  );
  const contentW = stColIii + stColIv;
  const pageW = contentW + MARGIN_LEFT + MARGIN_RIGHT;
  const pageH =
    estimateContentHeightAtScale(
      nRegular,
      nProductive,
      vScale,
      includeGpGrupo,
      estimateOpts,
    ) +
    MARGIN_TOP +
    MARGIN_BOTTOM +
    PAGE_H_BUFFER +
    (pageLayoutExtra?.pageBufferExtra ?? 0);

  return {
    pageW,
    pageH,
    contentW,
    vScale,
    stColIii,
    stColIv,
    stIiiCols,
    stIvCols,
    stAllCols: [...stIiiCols, ...stIvCols],
    stTableW: contentW,
    ieRowW: contentW,
    ieRowCols: computeIeRowCols(contentW),
    ieDirRowCols: computeIeDirRowCols(contentW),
    ieMunRowCols: computeIeMunRowCols(contentW),
    ieDirCedRowCols: computeIeDirCedRowCols(contentW),
    nRegular,
    nProductive,
    nIvCols: stIvCols.length,
    includeGpGrupo,
    tipoPlanilla: data.tipoPlanilla,
    useSpanishNames:
      (variant.useSpanishNames ?? false) || data.tipoPlanilla === "31060",
    logoMarginLeft: variant.logoMarginLeft ?? 0,
    ...(includeGpGrupo
      ? {
          ivGpIndex: nRegular + nProductive,
          ivGrupoIndex: nRegular + nProductive + 1,
        }
      : {}),
  };
}

function ivColSpanW(layout: SheetLayout, start: number, count: number): number {
  return layout.stIvCols.slice(start, start + count).reduce((a, b) => a + b, 0);
}

function iiiSpanW(layout: SheetLayout, start: number, count: number): number {
  return layout.stIiiCols
    .slice(start, start + count)
    .reduce((a, b) => a + b, 0);
}

function padTotal(n: number): string {
  return String(n).padStart(2, "0");
}

function gradeLabelUpper(gradeLevel: string): string {
  return (GRADE_LABELS[gradeLevel] ?? gradeLevel).toUpperCase();
}

function remisionDateFromYearRange(yearRange: string): string {
  const match = yearRange.match(/(\d{4})\s*[-?/]\s*(\d{4})/);
  if (!match) return "";
  return `12-07-${match[2]}`;
}

function tblFooterP(
  text: string,
  opts?: {
    bold?: boolean;
    size?: number;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
  },
): Paragraph {
  return new Paragraph({
    children: [
      t(text, {
        size: opts?.size ?? ST_HDR_FONT_SIZE,
        bold: opts?.bold ?? false,
      }),
    ],
    alignment: opts?.align ?? AlignmentType.LEFT,
    spacing: { before: 0, after: 0, line: 200, lineRule: "exact" as const },
  });
}

function mkFooterDataCell(
  w: number,
  text: string,
  opts?: {
    bold?: boolean;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    size?: number;
  },
): TableCell {
  return new TableCell({
    width: { size: w, type: WidthType.DXA },
    children: [
      tblFooterP(text, {
        bold: opts?.bold,
        align: opts?.align ?? AlignmentType.LEFT,
        size: opts?.size ?? (opts?.bold ? ST_HDR_FONT_SIZE : ST_DATA_FONT_SIZE),
      }),
    ],
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 4, bottom: 4, left: 6, right: 4 },
  });
}

function mkFooterSpanCell(
  layout: SheetLayout,
  children: (Paragraph | Table)[],
  minHeight?: number,
): TableRow {
  return mkStHdrRow(
    [
      new TableCell({
        columnSpan: layout.stIiiCols.length + layout.nIvCols,
        width: { size: layout.stTableW, type: WidthType.DXA },
        children,
        verticalAlign: VerticalAlign.TOP,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      }),
    ],
    minHeight ?? rowH(layout, FOOT_TOTAL_ROW_H),
  );
}

function buildTotalRows(
  data: ResumenFinalDocxData,
  layout: SheetLayout,
): TableRow[] {
  return buildAreaTotalRows(
    data,
    {
      stIiiCols: layout.stIiiCols,
      stIvCols: layout.stIvCols,
      nRegular: layout.nRegular,
      nProductive: layout.nProductive,
      ...(layout.includeGpGrupo
        ? { ivGpIndex: layout.ivGpIndex, ivGrupoIndex: layout.ivGrupoIndex }
        : {}),
    },
    {
      iiiSpanW: (l, start, count) => iiiSpanW(layout, start, count),
      padTotal,
      mkStHdrRow,
      mkStHdrCell,
      rowH: (base) => rowH(layout, base),
      footTotalRowH: FOOT_TOTAL_ROW_H,
    },
  );
}

function buildProfesoresCursoRow(
  data: ResumenFinalDocxData,
  layout: SheetLayout,
): TableRow {
  return mkFooterSpanCell(layout, [
    buildProfesoresCursoTable(
      data,
      {
        stTableW: layout.stTableW,
        stColIii: layout.stColIii,
        stColIv: layout.stColIv,
        ivMateriaW: IV_MATERIA_W,
        stIvCols: layout.stIvCols,
      },
      {
        rowH: (base) => rowH(layout, base),
        mkStHdrRow,
        mkFooterDataCell,
        tblFooterP,
        gradeLabelUpper,
        bordersGrid: BORDERS_GRID,
        bordersNestedGrid: BORDERS_GRID_NESTED,
      },
      { includeGpParticipacionRow: layout.includeGpGrupo },
    ),
  ]);
}

function buildObservacionesRow(
  data: ResumenFinalDocxData,
  layout: SheetLayout,
): TableRow {
  const obs = (data.observaciones ?? "").trim();
  return mkFooterSpanCell(
    layout,
    [
      tblFooterP(RF.OBSERVACIONES, { bold: true }),
      ...(obs
        ? [
            new Paragraph({
              children: [t(obs, { size: ST_DATA_FONT_SIZE })],
              spacing: {
                before: 6,
                after: 0,
                line: 220,
                lineRule: "exact" as const,
              },
            }),
          ]
        : []),
    ],
    rowH(layout, FOOT_OBS_H, 400),
  );
}

function mkSigCell(
  w: number,
  text: string,
  opts?: {
    bold?: boolean;
    rowSpan?: number;
  },
): TableCell {
  return new TableCell({
    ...(opts?.rowSpan ? { rowSpan: opts.rowSpan } : {}),
    width: { size: w, type: WidthType.DXA },
    children: [tblFooterP(text, { bold: opts?.bold })],
    verticalAlign: VerticalAlign.TOP,
    margins: { top: 6, bottom: 4, left: 6, right: 4 },
  });
}

function mkSigSealCell(w: number, text: string, rowSpan: number): TableCell {
  return new TableCell({
    rowSpan,
    width: { size: w, type: WidthType.DXA },
    children: [
      tblP(text, {
        size: ST_HDR_FONT_SIZE,
        align: AlignmentType.CENTER,
      }),
    ],
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 6, bottom: 4, left: 6, right: 4 },
  });
}

function buildFirmasBlockLocal(
  data: ResumenFinalDocxData,
  tableW: number,
  layout: SheetLayout,
): Table {
  return buildFirmasBlock(data, tableW, {
    rowH: (base, min) => rowH(layout, base, min),
    mkStHdrRow,
    mkSigCell,
    mkSigSealCell,
    remisionDateFromYearRange,
    bordersGrid: BORDERS_GRID,
  });
}

function buildFooterRows(
  data: ResumenFinalDocxData,
  layout: SheetLayout,
): TableRow[] {
  return [
    ...buildTotalRows(data, layout),
    buildProfesoresCursoRow(data, layout),
    buildObservacionesRow(data, layout),
    mkFooterSpanCell(layout, [
      buildFirmasBlockLocal(data, layout.stTableW, layout),
    ]),
  ];
}

const BS = { style: BorderStyle.SINGLE, size: 4, color: "000000" } as const;
const BN = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } as const;
const BORDERS_NONE = {
  top: BN,
  bottom: BN,
  left: BN,
  right: BN,
  insideHorizontal: BN,
  insideVertical: BN,
};
const BORDERS_GRID = {
  top: BS,
  bottom: BS,
  left: BS,
  right: BS,
  insideHorizontal: BS,
  insideVertical: BS,
};
const BORDERS_GRID_NESTED = {
  ...BORDERS_GRID,
  left: BN,
};

type TxtOpts = {
  bold?: boolean;
  size?: number;
  font?: string;
  underline?: boolean;
  color?: string;
};

function t(text: string, opts?: TxtOpts): TextRun {
  return new TextRun({
    text: text ?? "",
    font: opts?.font ?? HDR_FONT,
    size: (opts?.size ?? HDR_BODY_SIZE) * 2,
    bold: opts?.bold ?? false,
    color: opts?.color,
    underline: opts?.underline ? { type: UnderlineType.SINGLE } : undefined,
  });
}

function ieP(
  children: TextRun | TextRun[],
  align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT,
): Paragraph {
  return new Paragraph({
    children: Array.isArray(children) ? children : [children],
    alignment: align,
    spacing: {
      before: 0,
      after: 0,
      line: IE_LINE_SPACING,
      lineRule: "exact" as const,
    },
  });
}

function hdrP(
  children: TextRun | TextRun[],
  align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT,
): Paragraph {
  return new Paragraph({
    children: Array.isArray(children) ? children : [children],
    alignment: align,
    spacing: {
      before: 0,
      after: 0,
      line: HDR_LINE_SPACING,
      lineRule: "exact" as const,
    },
  });
}

function tblP(
  text: string,
  opts?: {
    bold?: boolean;
    size?: number;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
  },
): Paragraph {
  return new Paragraph({
    children: [
      t(text, {
        size: opts?.size ?? ST_HDR_FONT_SIZE,
        bold: opts?.bold ?? false,
      }),
    ],
    alignment: opts?.align ?? AlignmentType.CENTER,
    spacing: { before: 0, after: 0, line: 200, lineRule: "exact" as const },
  });
}

function tblPMulti(text: string, bold = true): Paragraph[] {
  return text.split("\n").map(
    (line, i) =>
      new Paragraph({
        children: [t(line, { size: ST_HDR_FONT_SIZE, bold })],
        alignment: AlignmentType.CENTER,
        spacing: {
          before: i === 0 ? ST_HDR_MULTILINE_BEFORE : 0,
          after: 0,
          line: 180,
          lineRule: "exact" as const,
        },
      }),
  );
}

function tblPVertical(word: string, line = ST_HDR_VERT_LINE): Paragraph[] {
  return word.split("").map(
    (letter) =>
      new Paragraph({
        children: [t(letter, { size: ST_HDR_FONT_SIZE, bold: true })],
        alignment: AlignmentType.CENTER,
        spacing: {
          before: 0,
          after: 0,
          line,
          lineRule: "atLeast" as const,
        },
      }),
  );
}

function mesAnioFromYearRange(yearRange: string): string {
  const match = yearRange.match(/(\d{4})\s*[-?/]\s*(\d{4})/);
  return match ? `Julio ${match[2]}` : "";
}

function twipsToImagePx(twips: number): number {
  return Math.round((twips / 1440) * 96);
}

function getPngDimensions(
  buffer: ArrayBuffer,
): { width: number; height: number } | null {
  if (buffer.byteLength < 24) return null;
  const v = new DataView(buffer);
  return { width: v.getUint32(16), height: v.getUint32(20) };
}

type DocxImageType = "png" | "jpg" | "gif" | "bmp";

function detectImageType(buffer: ArrayBuffer): DocxImageType {
  const v = new Uint8Array(buffer);
  if (v[0] === 0x89 && v[1] === 0x50) return "png";
  if (v[0] === 0xff && v[1] === 0xd8) return "jpg";
  if (v[0] === 0x47 && v[1] === 0x49) return "gif";
  if (v[0] === 0x42 && v[1] === 0x4d) return "bmp";
  return "png";
}

function getJpegDimensions(
  buffer: ArrayBuffer,
): { width: number; height: number } | null {
  const v = new Uint8Array(buffer);
  if (v.length < 4 || v[0] !== 0xff || v[1] !== 0xd8) return null;
  let offset = 2;
  while (offset < v.length - 8) {
    if (v[offset] !== 0xff) break;
    const marker = v[offset + 1];
    const len = (v[offset + 2] << 8) | v[offset + 3];
    if (marker === 0xc0 || marker === 0xc2) {
      const height = (v[offset + 5] << 8) | v[offset + 6];
      const width = (v[offset + 7] << 8) | v[offset + 8];
      if (width > 0 && height > 0) return { width, height };
      return null;
    }
    offset += 2 + len;
  }
  return null;
}

function getImageDimensions(
  buffer: ArrayBuffer,
): { width: number; height: number } | null {
  const kind = detectImageType(buffer);
  if (kind === "png") return getPngDimensions(buffer);
  if (kind === "jpg") return getJpegDimensions(buffer);
  return null;
}

function logoImageSize(
  cellWidthTwips: number,
  logoBuffer: ArrayBuffer,
  maxHeightPx = LOGO_MAX_HEIGHT_PX,
): { width: number; height: number } {
  const widthPx = twipsToImagePx(cellWidthTwips);
  const dims = getImageDimensions(logoBuffer);
  if (!dims?.width || !dims?.height)
    return { width: widthPx, height: Math.round(widthPx * 0.2) };

  let width = widthPx;
  let height = Math.round(widthPx * (dims.height / dims.width));
  if (height > maxHeightPx) {
    const scale = maxHeightPx / height;
    height = maxHeightPx;
    width = Math.round(width * scale);
  }
  return { width, height };
}

function mkCompactGap(before = 0): Paragraph {
  return new Paragraph({
    spacing: { before, after: 0, line: 20, lineRule: "exact" as const },
    children: [t("", { size: 1 })],
  });
}

function mkRow(cells: TableCell[]): TableRow {
  return new TableRow({ children: cells });
}

function mkStHdrRow(cells: TableCell[], minHeight: number): TableRow {
  return new TableRow({
    children: cells,
    height: { value: minHeight, rule: HeightRule.ATLEAST },
  });
}

function mkFixedTable(
  rows: TableRow[],
  tableWidth: number,
  columnWidths: number[],
  borders: typeof BORDERS_NONE | typeof BORDERS_GRID = BORDERS_NONE,
): Table {
  return new Table({
    width: { size: tableWidth, type: WidthType.DXA },
    columnWidths,
    layout: TableLayoutType.FIXED,
    rows,
    borders,
  });
}

function ieCellMargins(
  gapTop: number,
  base: { top?: number; bottom?: number; left: number; right: number },
) {
  return {
    top: (base.top ?? 0) + gapTop,
    bottom: base.bottom ?? 0,
    left: base.left,
    right: base.right,
  };
}

function mkIeLabelCell(w: number, text: string, gapTop = 0): TableCell {
  return new TableCell({
    width: { size: w, type: WidthType.DXA },
    children: [ieP(t(text, { size: BODY_LABEL_SIZE }))],
    borders: BORDERS_NONE,
    verticalAlign: VerticalAlign.BOTTOM,
    margins: ieCellMargins(gapTop, { top: 0, bottom: 0, left: 0, right: 4 }),
  });
}

function mkIeSpacerCell(w: number, gapTop = 0): TableCell {
  return new TableCell({
    width: { size: w, type: WidthType.DXA },
    children: [ieP(t(""))],
    borders: BORDERS_NONE,
    margins: ieCellMargins(gapTop, { top: 0, bottom: 0, left: 0, right: 0 }),
  });
}

function mkIeLineCell(
  w: number,
  value: string,
  size = BODY_DATA_SIZE,
  gapTop = 0,
): TableCell {
  return new TableCell({
    width: { size: w, type: WidthType.DXA },
    children: [ieP(t(value, { size }), AlignmentType.CENTER)],
    borders: { top: BN, left: BN, right: BN, bottom: BS },
    verticalAlign: VerticalAlign.BOTTOM,
    margins: ieCellMargins(gapTop, { top: 0, bottom: 0, left: 2, right: 2 }),
  });
}

function mkLabelCell(
  w: number,
  text: string,
  span = 1,
  bold = false,
): TableCell {
  return new TableCell({
    ...(span > 1 ? { columnSpan: span } : {}),
    width: { size: w, type: WidthType.DXA },
    children: [hdrP(t(text, { size: HDR_BODY_SIZE, bold }))],
    borders: BORDERS_NONE,
    verticalAlign: VerticalAlign.BOTTOM,
    margins: { top: 0, bottom: 0, left: 0, right: 4 },
  });
}

function mkBottomLineCell(
  w: number,
  value = "",
  span = 1,
  size = BODY_DATA_SIZE,
): TableCell {
  return new TableCell({
    ...(span > 1 ? { columnSpan: span } : {}),
    width: { size: w, type: WidthType.DXA },
    children: [hdrP(t(value, { size }), AlignmentType.CENTER)],
    borders: { top: BN, left: BN, right: BN, bottom: BS },
    verticalAlign: VerticalAlign.BOTTOM,
    margins: { top: 0, bottom: 0, left: 4, right: 0 },
  });
}

function mkStTitleCell(
  w: number,
  text: string,
  side: "left" | "right",
  columnSpan = 1,
): TableCell {
  return new TableCell({
    ...(columnSpan > 1 ? { columnSpan } : {}),
    width: { size: w, type: WidthType.DXA },
    children: [
      tblP(text, {
        bold: true,
        size: ST_HDR_FONT_SIZE,
        align: AlignmentType.LEFT,
      }),
    ],
    verticalAlign: VerticalAlign.BOTTOM,
    margins: {
      top: ST_TITLE_PAD_TOP,
      bottom: ST_TITLE_PAD_BOTTOM,
      left: side === "left" ? 8 : 20,
      right: 20,
    },
  });
}

type StHdrCellOpts = {
  rowSpan?: number;
  columnSpan?: number;
  multiline?: string;
  vertical?: boolean;
  vertCompact?: boolean; // EF, SEXO, DIA, MES, A?O
  verticalMerge?: (typeof VerticalMergeType)[keyof typeof VerticalMergeType];
  fit?: boolean; // reduce el tamaño para que la sigla quepa en UNA sola línea
};

/**
 * Calcula el tamaño de fuente para que `text` (Arial bold, mayúsculas) quepa en
 * una sola línea dentro de una celda de ancho `w` (twips). Solo encoge: nunca
 * supera ST_HDR_FONT_SIZE. Sirve para siglas largas como "GHSN" en columnas
 * angostas (IV_MATERIA_W = 450). Ajustar TWIPS_PER_CHAR_PT si algo aún se parte.
 */
const TWIPS_PER_CHAR_PT = 14; // ancho aprox. de un carácter, en twips por punto
function fitHdrSize(text: string, w: number, sideMargin: number): number {
  const avail = w - sideMargin * 2;
  const len = Math.max(1, text.length);
  const fit = Math.floor(avail / (TWIPS_PER_CHAR_PT * len));
  return Math.min(ST_HDR_FONT_SIZE, Math.max(6, fit));
}

function mkStHdrCell(w: number, text: string, opts?: StHdrCellOpts): TableCell {
  const sideMargin = opts?.vertCompact ? 2 : 8;
  const children = opts?.multiline
    ? tblPMulti(opts.multiline)
    : opts?.vertical
      ? tblPVertical(text, ST_HDR_VERT_LINE)
      : [
          tblP(text, {
            bold: true,
            size: opts?.fit ? fitHdrSize(text, w, sideMargin) : ST_HDR_FONT_SIZE,
          }),
        ];

  const padTop = opts?.vertCompact ? ST_HDR_VERT_PAD_TOP : ST_HDR_CELL_PAD_TOP;
  const padBottom = opts?.vertCompact
    ? ST_HDR_VERT_PAD_BOTTOM
    : ST_HDR_CELL_PAD_BOTTOM;

  return new TableCell({
    ...(opts?.rowSpan ? { rowSpan: opts.rowSpan } : {}),
    ...(opts?.columnSpan ? { columnSpan: opts.columnSpan } : {}),
    ...(opts?.verticalMerge ? { verticalMerge: opts.verticalMerge } : {}),
    width: { size: w, type: WidthType.DXA },
    children,
    verticalAlign: VerticalAlign.CENTER,
    margins: {
      top: padTop,
      bottom: padBottom,
      left: opts?.vertCompact ? 2 : 8,
      right: opts?.vertCompact ? 2 : 8,
    },
  });
}

function mkIvMergeContinue(
  layout: SheetLayout,
  start: number,
  count: number,
): TableCell {
  return new TableCell({
    columnSpan: count,
    verticalMerge: VerticalMergeType.CONTINUE,
    width: { size: ivColSpanW(layout, start, count), type: WidthType.DXA },
    children: [tblP("")],
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 0, bottom: 0, left: 2, right: 2 },
  });
}

function formatStField(
  value: string,
  empty = ST_EMPTY,
  useSpanishNames = false,
): string {
  const v = (value ?? "").trim();
  if (!v) return empty;
  return formatPlanillaStudentText(v, useSpanishNames);
}

function formatStNro(n: number): string {
  return String(n);
}

function emptyStudentRow(nro: number): StudentDocxRow {
  return {
    nro,
    cedula: "",
    apellidos: "",
    nombres: "",
    lugarNacimiento: "",
    entidadFederal: "",
    sexo: "",
    diaNac: "",
    mesNac: "",
    anioNac: "",
    grades: {},
    gpGrade: "",
    grupoName: "",
  };
}

function padStudentsPage(students: StudentDocxRow[]): StudentDocxRow[] {
  const rows = [...students];
  for (let nro = rows.length + 1; nro <= ST_ROWS_PER_PAGE; nro++) {
    rows.push(emptyStudentRow(nro));
  }
  return rows.slice(0, ST_ROWS_PER_PAGE);
}

function mkStDataCell(
  w: number,
  text: string,
  align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT,
): TableCell {
  return new TableCell({
    width: { size: w, type: WidthType.DXA },
    children: [
      new Paragraph({
        children: [t(text, { size: ST_DATA_FONT_SIZE, bold: false })],
        alignment: align,
        // line 240 (12pt) da altura suficiente para no recortar diacríticos
        // (virgulilla de Ñ, tildes) con texto Arial 10pt. La fila es ATLEAST
        // ST_DATA_ROW_MIN (412), así que esto no altera el alto ni el layout.
        spacing: { before: 0, after: 0, line: 240, lineRule: "exact" as const },
      }),
    ],
    verticalAlign: VerticalAlign.CENTER,
    margins: {
      top: ST_DATA_CELL_PAD,
      bottom: ST_DATA_CELL_PAD,
      left: align === AlignmentType.CENTER ? 0 : ST_DATA_CELL_PAD_LEFT,
      right: align === AlignmentType.CENTER ? 0 : 0,
    },
  });
}

function mkStDataRow(
  row: StudentDocxRow,
  layout: SheetLayout,
  regularSubjects: ResumenFinalDocxData["regularSubjects"],
  productiveSubjects: ResumenFinalDocxData["productiveSubjects"],
  isEmpty: boolean,
): TableRow {
  const { nRegular } = layout;
  const regularCells = regularSubjects.map((s, i) =>
    mkStDataCell(
      layout.stIvCols[i],
      isEmpty ? "" : (row.grades[s.assignmentId] ?? ""),
      AlignmentType.CENTER,
    ),
  );
  const productiveCells = productiveSubjects.map((s, i) =>
    mkStDataCell(
      layout.stIvCols[nRegular + i],
      isEmpty ? "" : (row.grades[s.assignmentId] ?? ""),
      AlignmentType.CENTER,
    ),
  );
  const gpGrade = isEmpty ? "" : row.gpGrade;
  const grupoName = isEmpty ? "" : row.grupoName;
  const gpCells =
    layout.includeGpGrupo &&
    layout.ivGpIndex !== undefined &&
    layout.ivGrupoIndex !== undefined
      ? [
          mkStDataCell(
            layout.stIvCols[layout.ivGpIndex],
            gpGrade,
            AlignmentType.CENTER,
          ),
          mkStDataCell(
            layout.stIvCols[layout.ivGrupoIndex],
            grupoName,
            AlignmentType.LEFT,
          ),
        ]
      : [];

  return mkStHdrRow(
    [
      mkStDataCell(ST_III_NRO, formatStNro(row.nro)),
      mkStDataCell(ST_III_CED, formatStField(row.cedula)),
      mkStDataCell(
        ST_III_APE,
        layout.useSpanishNames
          ? formatPlanillaStudentText(row.apellidos, true)
          : formatStField(row.apellidos),
      ),
      mkStDataCell(
        ST_III_NOM,
        layout.useSpanishNames
          ? formatPlanillaStudentText(row.nombres, true)
          : formatStField(row.nombres),
      ),
      mkStDataCell(ST_III_LUG, formatStField(row.lugarNacimiento)),
      mkStDataCell(
        ST_III_EF,
        formatStField(row.entidadFederal, ST_EMPTY_SHORT),
        AlignmentType.CENTER,
      ),
      mkStDataCell(
        ST_III_SEX,
        formatStField(row.sexo, ST_EMPTY_SHORT),
        AlignmentType.CENTER,
      ),
      mkStDataCell(
        ST_III_DIA,
        formatStField(row.diaNac, ST_EMPTY_SHORT),
        AlignmentType.CENTER,
      ),
      mkStDataCell(
        ST_III_MES,
        formatStField(row.mesNac, ST_EMPTY_SHORT),
        AlignmentType.CENTER,
      ),
      mkStDataCell(
        ST_III_ANO,
        formatStField(row.anioNac, ST_EMPTY_SHORT),
        AlignmentType.CENTER,
      ),
      ...regularCells,
      ...productiveCells,
      ...gpCells,
    ],
    rowH(layout, ST_DATA_ROW_MIN, 280),
  );
}

function buildEstudiantesBlock(
  data: ResumenFinalDocxData,
  layout: SheetLayout,
): Table {
  const { nRegular, nProductive, nIvCols, includeGpGrupo } = layout;
  const ivGpIndex = layout.ivGpIndex ?? 0;
  const ivGrupoIndex = layout.ivGrupoIndex ?? 0;
  const regularSubjects = data.regularSubjects;
  const productiveSubjects = data.productiveSubjects;
  const nSubjectCols = nRegular + nProductive;
  const participacionLabel = RF.PARTICIPACION_GRUPOS;
  const padded = padStudentsPage(data.students);
  const dataRows = padded.map((row, idx) =>
    mkStDataRow(
      row,
      layout,
      regularSubjects,
      productiveSubjects,
      idx >= data.students.length,
    ),
  );

  const ivHdrRow1Cells = includeGpGrupo
    ? [
        mkStHdrCell(ivColSpanW(layout, 0, nSubjectCols), RF.AREAS_FORMACION, {
          columnSpan: nSubjectCols,
        }),
        mkStHdrCell(ivColSpanW(layout, ivGpIndex, 2), "", {
          columnSpan: 2,
          verticalMerge: VerticalMergeType.RESTART,
          multiline: participacionLabel,
        }),
      ]
    : [
        mkStHdrCell(ivColSpanW(layout, 0, nIvCols), RF.AREAS_FORMACION, {
          columnSpan: nIvCols,
        }),
      ];

  const ivHdrRow3Cells = includeGpGrupo
    ? [
        ...regularSubjects.map((_, i) =>
          mkStHdrCell(layout.stIvCols[i], String(i + 1)),
        ),
        ...productiveSubjects.map((_, i) =>
          mkStHdrCell(
            layout.stIvCols[nRegular + i],
            String(nRegular + i + 1),
          ),
        ),
        mkStHdrCell(layout.stIvCols[ivGpIndex], String(nSubjectCols + 1)),
        mkStHdrCell(layout.stIvCols[ivGrupoIndex], RF.GRUPO, {
          verticalMerge: VerticalMergeType.RESTART,
        }),
      ]
    : [
        ...regularSubjects.map((_, i) =>
          mkStHdrCell(layout.stIvCols[i], String(i + 1)),
        ),
        ...productiveSubjects.map((_, i) =>
          mkStHdrCell(
            layout.stIvCols[nRegular + i],
            String(nRegular + i + 1),
          ),
        ),
      ];

  const ivHdrRow4Cells = includeGpGrupo
    ? [
        ...regularSubjects.map((s, i) =>
          mkStHdrCell(layout.stIvCols[i], s.abbreviation.toUpperCase(), {
            fit: true,
          }),
        ),
        ...productiveSubjects.map((s, i) =>
          mkStHdrCell(
            layout.stIvCols[nRegular + i],
            s.abbreviation.toUpperCase(),
            { fit: true },
          ),
        ),
        mkStHdrCell(layout.stIvCols[ivGpIndex], RF.GP),
        mkIvMergeContinue(layout, ivGrupoIndex, 1),
      ]
    : [
        ...regularSubjects.map((s, i) =>
          mkStHdrCell(layout.stIvCols[i], s.abbreviation.toUpperCase(), {
            fit: true,
          }),
        ),
        ...productiveSubjects.map((s, i) =>
          mkStHdrCell(
            layout.stIvCols[nRegular + i],
            s.abbreviation.toUpperCase(),
            { fit: true },
          ),
        ),
      ];

  const ivHdrRow2Extra = includeGpGrupo
    ? [mkIvMergeContinue(layout, ivGpIndex, 2)]
    : [];

  return new Table({
    width: { size: layout.stTableW, type: WidthType.DXA },
    columnWidths: layout.stAllCols,
    layout: TableLayoutType.FIXED,
    borders: BORDERS_GRID,
    rows: [
      mkStHdrRow(
        [
          mkStTitleCell(
            layout.stColIii,
            RF.III_ESTUDIANTE,
            "left",
            layout.stIiiCols.length,
          ),
          mkStTitleCell(
            layout.stColIv,
            RF.IV_RENDIMIENTO,
            "right",
            nIvCols,
          ),
        ],
        rowH(layout, ST_TITLE_ROW_MIN, 280),
      ),
      mkStHdrRow(
        [
          mkStHdrCell(ST_III_NRO, RF.NRO, { rowSpan: III_HDR_ROW_SPAN }),
          mkStHdrCell(ST_III_CED, "", {
            rowSpan: III_HDR_ROW_SPAN,
            multiline: RF.CEDULA_IDENTIDAD,
          }),
          mkStHdrCell(ST_III_APE, "Apellidos", { rowSpan: III_HDR_ROW_SPAN }),
          mkStHdrCell(ST_III_NOM, "Nombres", { rowSpan: III_HDR_ROW_SPAN }),
          mkStHdrCell(ST_III_LUG, "", {
            rowSpan: III_HDR_ROW_SPAN,
            multiline: RF.LUGAR_NACIMIENTO,
          }),
          mkStHdrCell(ST_III_EF, "EF", {
            rowSpan: III_HDR_ROW_SPAN,
            vertical: true,
            vertCompact: true,
          }),
          mkStHdrCell(ST_III_SEX, "SEXO", {
            rowSpan: III_HDR_ROW_SPAN,
            vertical: true,
            vertCompact: true,
          }),
          mkStHdrCell(ST_III_FECHA_W, "", {
            columnSpan: 3,
            multiline: RF.FECHA_NACIMIENTO,
          }),
          ...ivHdrRow1Cells,
        ],
        rowH(layout, ST_IV_HDR_ROW1, 280),
      ),
      mkStHdrRow(
        [
          mkStHdrCell(ST_III_DIA, "DIA", {
            rowSpan: FECHA_SUB_ROW_SPAN,
            vertical: true,
            vertCompact: true,
          }),
          mkStHdrCell(ST_III_MES, "MES", {
            rowSpan: FECHA_SUB_ROW_SPAN,
            vertical: true,
            vertCompact: true,
          }),
          mkStHdrCell(ST_III_ANO, RF.ANO, {
            rowSpan: FECHA_SUB_ROW_SPAN,
            vertical: true,
            vertCompact: true,
          }),
          mkStHdrCell(ivColSpanW(layout, 0, nRegular), RF.COMPONENTE_GENERAL, {
            columnSpan: nRegular,
          }),
          ...(nProductive > 0
            ? [
                mkStHdrCell(
                  ivColSpanW(layout, nRegular, nProductive),
                  RF.COMPONENTE_PRODUCTIVO,
                  {
                    columnSpan: nProductive,
                  },
                ),
              ]
            : []),
          ...ivHdrRow2Extra,
        ],
        rowH(layout, ST_IV_HDR_ROW2, 280),
      ),
      mkStHdrRow(ivHdrRow3Cells, rowH(layout, ST_IV_HDR_ROW3, 260)),
      mkStHdrRow(ivHdrRow4Cells, rowH(layout, ST_IV_HDR_ROW4, 280)),
      ...dataRows,
      ...buildFooterRows(data, layout),
    ],
  });
}

async function buildHeaderBlock(
  data: ResumenFinalDocxData,
  logoBuffer: ArrayBuffer | null,
  layout: SheetLayout,
): Promise<Table> {
  const leftW = Math.round(layout.contentW * LOGO_WIDTH_RATIO);
  const rightW = layout.contentW - leftW;
  const rightInnerW = rightW - HDR_TITLE_INDENT;

  const logoMaxH = Math.max(48, Math.round(LOGO_MAX_HEIGHT_PX * layout.vScale));
  const logoSize = logoBuffer
    ? logoImageSize(leftW, logoBuffer, logoMaxH)
    : null;
  const logoCell = new TableCell({
    width: { size: leftW, type: WidthType.DXA },
    children:
      logoBuffer && logoSize
        ? [
            new Paragraph({
              children: [
                new ImageRun({
                  type: detectImageType(logoBuffer),
                  data: logoBuffer,
                  transformation: logoSize,
                }),
              ],
              alignment: AlignmentType.LEFT,
              spacing: { before: 0, after: 0 },
            }),
          ]
        : [
            hdrP(
              t("GOBIERNO BOLIVARIANO DE VENEZUELA", { bold: true, size: 8 }),
            ),
          ],
    borders: BORDERS_NONE,
    verticalAlign: VerticalAlign.TOP,
    margins: {
      top: 0,
      bottom: 0,
      left: layout.logoMarginLeft,
      right: 20,
    },
  });

  const wLineMes = rightInnerW - W_LBL_COL0 - W_LINE_TIPO - W_LBL_MES;
  const wLineAnoSpan = W_LINE_TIPO + W_LBL_MES + wLineMes;
  const fieldColWidths = [W_LBL_COL0, W_LINE_TIPO, W_LBL_MES, wLineMes];

  const fieldsTable = mkFixedTable(
    [
      mkRow([
        mkLabelCell(W_LBL_COL0, RF.ANO_ESCOLAR, 1, true),
        mkBottomLineCell(wLineAnoSpan, data.yearRange, 3),
      ]),
      mkRow([
        mkLabelCell(W_LBL_COL0, RF.TIPO_EVALUACION, 1, true),
        mkBottomLineCell(W_LINE_TIPO, "Final"),
        mkLabelCell(W_LBL_MES, RF.MES_Y_ANO, 1, true),
        mkBottomLineCell(wLineMes, mesAnioFromYearRange(data.yearRange)),
      ]),
    ],
    rightInnerW,
    fieldColWidths,
  );

  const infoTable = mkFixedTable(
    [
      mkRow([
        new TableCell({
          width: { size: rightInnerW, type: WidthType.DXA },
          children: [
            hdrP(
              t(RF.TITULO, {
                size: HDR_TITLE_SIZE,
                bold: true,
                underline: true,
              }),
              AlignmentType.CENTER,
            ),
            hdrP(
              t(RF.codigoFormato(data.tipoPlanilla), {
                size: HDR_BODY_SIZE,
                bold: true,
              }),
              AlignmentType.CENTER,
            ),
          ],
          borders: BORDERS_NONE,
          verticalAlign: VerticalAlign.TOP,
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
        }),
      ]),
      mkRow([
        new TableCell({
          width: { size: rightInnerW, type: WidthType.DXA },
          children: [fieldsTable],
          borders: BORDERS_NONE,
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
        }),
      ]),
    ],
    rightInnerW,
    [rightInnerW],
  );

  const rightCell = new TableCell({
    width: { size: rightW, type: WidthType.DXA },
    children: [infoTable],
    borders: BORDERS_NONE,
    verticalAlign: VerticalAlign.TOP,
    margins: { top: 0, bottom: 0, left: HDR_TITLE_INDENT, right: 0 },
  });

  return mkFixedTable([mkRow([logoCell, rightCell])], layout.contentW, [
    leftW,
    rightW,
  ]);
}

function buildInstitucionBlock(
  data: ResumenFinalDocxData,
  layout: SheetLayout,
): Table {
  const h = data.schoolHeader;
  const ieGap = Math.max(12, Math.round(IE_ROW_GAP * layout.vScale));
  const ie = layout.ieRowCols;
  const ieDir = layout.ieDirRowCols;
  const ieMun = layout.ieMunRowCols;
  const ieCed = layout.ieDirCedRowCols;

  return mkFixedTable(
    [
      mkRow([
        new TableCell({
          columnSpan: 5,
          width: { size: layout.ieRowW, type: WidthType.DXA },
          children: [
            ieP(
              t(RF.II_INSTITUCION, {
                size: BODY_LABEL_SIZE,
                bold: true,
              }),
            ),
          ],
          borders: BORDERS_NONE,
          margins: {
            top: IE_TITLE_PAD_TOP,
            bottom: ieGap,
            left: 0,
            right: 0,
          },
        }),
      ]),
      mkRow([
        mkIeLabelCell(ie[0], RF.CODIGO_INSTITUCION),
        mkIeLineCell(ie[1], h.codigo_plantel ?? ""),
        mkIeSpacerCell(ie[2]),
        mkIeLabelCell(ie[3], RF.EPONIMO),
        mkIeLineCell(ie[4], h.nombre_plantel ?? ""),
      ]),
      mkRow([
        new TableCell({
          columnSpan: 5,
          width: { size: layout.ieRowW, type: WidthType.DXA },
          children: [
            mkFixedTable(
              [
                mkRow([
                  mkIeLabelCell(ieDir[0], RF.DIRECCION, ieGap),
                  mkIeLineCell(
                    ieDir[1],
                    h.direccion_plantel ?? "",
                    BODY_DATA_SIZE,
                    ieGap,
                  ),
                  mkIeSpacerCell(ieDir[2], ieGap),
                  mkIeLabelCell(ieDir[3], RF.TELEFONO, ieGap),
                  mkIeLineCell(
                    ieDir[4],
                    h.telefono_plantel ?? "",
                    BODY_DATA_SIZE,
                    ieGap,
                  ),
                ]),
              ],
              layout.ieRowW,
              ieDir,
            ),
          ],
          borders: BORDERS_NONE,
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
        }),
      ]),
      mkRow([
        new TableCell({
          columnSpan: 5,
          width: { size: layout.ieRowW, type: WidthType.DXA },
          children: [
            mkFixedTable(
              [
                mkRow([
                  mkIeLabelCell(ieMun[0], "Municipio:", ieGap),
                  mkIeLineCell(
                    ieMun[1],
                    h.municipio_plantel ?? "",
                    BODY_DATA_SIZE,
                    ieGap,
                  ),
                  mkIeSpacerCell(ieMun[2], ieGap),
                  mkIeLabelCell(ieMun[3], "Entidad federal:", ieGap),
                  mkIeLineCell(
                    ieMun[4],
                    h.entidad_federal ?? "",
                    BODY_DATA_SIZE,
                    ieGap,
                  ),
                  mkIeSpacerCell(ieMun[5], ieGap),
                  mkIeLabelCell(ieMun[6], "Zona Educativa:", ieGap),
                  mkIeLineCell(
                    ieMun[7],
                    h.zona_educativa ?? "",
                    BODY_DATA_SIZE,
                    ieGap,
                  ),
                ]),
              ],
              layout.ieRowW,
              ieMun,
            ),
          ],
          borders: BORDERS_NONE,
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
        }),
      ]),
      mkRow([
        new TableCell({
          columnSpan: 5,
          width: { size: layout.ieRowW, type: WidthType.DXA },
          children: [
            mkFixedTable(
              [
                mkRow([
                  mkIeLabelCell(ieCed[0], "Director (a):", ieGap),
                  mkIeLineCell(
                    ieCed[1],
                    h.director ?? "",
                    BODY_DATA_SIZE,
                    ieGap,
                  ),
                  mkIeSpacerCell(ieCed[2], ieGap),
                  mkIeLabelCell(ieCed[3], RF.CEDULA_IDENTIDAD_LABEL, ieGap),
                  mkIeLineCell(
                    ieCed[4],
                    h.cedula_director ?? "",
                    BODY_DATA_SIZE,
                    ieGap,
                  ),
                ]),
              ],
              layout.ieRowW,
              ieCed,
            ),
          ],
          borders: BORDERS_NONE,
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
        }),
      ]),
    ],
    layout.ieRowW,
    ie,
  );
}

async function buildDocumentContent(
  data: ResumenFinalDocxData,
  logoBuffer: ArrayBuffer | null,
  layout: SheetLayout,
): Promise<(Paragraph | Table)[]> {
  return [
    await buildHeaderBlock(data, logoBuffer, layout),
    ...(HDR_BLOCK_GAP > 0 ? [mkCompactGap(HDR_BLOCK_GAP)] : []),
    buildInstitucionBlock(data, layout),
    ...(ST_TABLE_GAP > 0
      ? [mkCompactGap(Math.round(ST_TABLE_GAP * layout.vScale))]
      : []),
    buildEstudiantesBlock(data, layout),
  ];
}

export async function generateResumenFinalDocxBase(
  sections: ResumenFinalDocxData | ResumenFinalDocxData[],
  variant: ResumenFinalDocxVariant,
): Promise<Blob> {
  const dataArray = Array.isArray(sections) ? sections : [sections];

  const logoUrl = variant.logoUrl ?? LOGO_URL;
  let logoBuffer: ArrayBuffer | null = null;
  try {
    const res = await fetch(logoUrl);
    if (res.ok) logoBuffer = await res.arrayBuffer();
  } catch {
    // sin logo
  }

  const docSections = await Promise.all(
    dataArray.map(async (data, index) => {
      const layout = computeSheetLayout(data, variant);
      return {
        properties: {
          ...(index > 0 ? { type: SectionType.NEXT_PAGE } : {}),
          page: {
            size: { width: layout.pageW, height: layout.pageH },
            margin: {
              top: MARGIN_TOP,
              bottom: MARGIN_BOTTOM,
              left: MARGIN_LEFT,
              right: MARGIN_RIGHT,
            },
          },
        },
        children: await buildDocumentContent(data, logoBuffer, layout),
      };
    }),
  );

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: HDR_FONT, size: HDR_BODY_SIZE * 2 },
          paragraph: {
            spacing: { before: PARA_SPACE_BEFORE, after: PARA_SPACE_AFTER },
          },
        },
      },
    },
    sections: docSections,
  });

  return Packer.toBlob(doc);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
