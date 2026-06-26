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
import { GRADE_LABELS } from "@/lib/buildInvoiceData";

// ─── página (estrategia UEH: hoja virtual alta; ancho dinámico según materias IV) ──
const PAGE_H = 31660; // ~55.80 cm — igual que UEH referencia
const cmToTwips = (cm: number) => Math.round((cm / 2.54) * 1440);
const MARGIN_LEFT = cmToTwips(0.8); // 0.8 cm
const MARGIN_RIGHT = cmToTwips(0.8); // 0.8 cm
const MARGIN_TOP = cmToTwips(0.8); // 0.8 cm
const MARGIN_BOTTOM = cmToTwips(0.8); // 0.8 cm
const PARA_SPACE_BEFORE = 8;
const HDR_BLOCK_GAP = 0; // espacio logo/cabecera → sección II (usar mkCompactGap)
const ST_TABLE_GAP = 30; // espacio sección II → tabla estudiantes

const PARA_SPACE_AFTER = 0;

// ─── cabecera — ajustar aquí ─────────────────────────────────────────
const LOGO_URL =
  "https://satescolar.s3.us-east-1.amazonaws.com/planillas/LOGO+ANTERIOR.png";
const LOGO_WIDTH_RATIO = 0.32;
const LOGO_MAX_HEIGHT_PX = 76; // limita altura logo → evita hueco bajo punto I
const HDR_TITLE_INDENT = 200;
const HDR_FONT = "Arial";
const HDR_TITLE_SIZE = 9;
const HDR_BODY_SIZE = 9;
const HDR_LINE_SPACING = 180;
const BODY_LABEL_SIZE = 9; // títulos / etiquetas
const BODY_DATA_SIZE = 10; // datos desde BD
const IE_LINE_SPACING = 185; // interlineado sección II
const IE_ROW_GAP = 34; // separación vertical entre filas sección II
const IE_TITLE_PAD_TOP = 6; // padding interno celda título II (no el hueco bajo logo)
// ─── tabla III + IV (estudiantes) — ajustar aquí ─────────────────────
const ST_COL_III_FIXED = 11201; // III fijo — no cambia con materias
const IV_MATERIA_W = 450; // ancho columna materia regular
const IV_PRODUCTIVE_W = 700; // ancho columna materia productiva (más ancho para encabezado)
const ST_TABLE_FONT_SIZE = 9; // Arial 9 — cabeceras tabla III/IV
const ST_HDR_FONT_SIZE = ST_TABLE_FONT_SIZE;
const ST_CELL_PAD = 10;
const ST_TITLE_ROW_MIN = 340; // altura fila títulos III/IV
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
const ST_HDR_VERT_LINE = 180; // ≥ altura Arial 9pt
const ST_HDR_CELL_PAD_TOP = 14; // aire arriba (N°, Cédula, etc.)
const ST_HDR_CELL_PAD_BOTTOM = 5;
const ST_HDR_MULTILINE_BEFORE = 7; // espacio 1ª línea multilínea
const ST_HDR_ROW1_MIN = 415; // altura mín. fila N°…Fecha de nacimiento (UEH: 415)
const ST_HDR_ROW2_MIN = 465; // altura mín. fila DIA / MES / AÑO (UEH: 465)
const ST_IV_HDR_ROW0 = 415; // título IV
const ST_IV_HDR_ROW1 = 465; // ÁREAS DE FORMACIÓN
const ST_IV_HDR_ROW2 = 415; // COMPONENTE GENERAL / COMPONENTE PRODUCTIVO
const ST_IV_HDR_ROW3 = 365; // números 1…N
const ST_IV_HDR_ROW4 = 415; // siglas
const III_HDR_ROW_SPAN = 4; // filas cabecera III (1–4) antes de datos
const FECHA_SUB_ROW_SPAN = 3; // DIA/MES/AÑO cubren filas 2–4
// ─── pie de tabla (totales V–IX) — UEH página 40 ─────────────────────
const FOOT_TOTAL_ROW_H = 412;
const FOOT_V_HDR_H = 252;
const FOOT_V_DATA_H = 412;
const FOOT_V_GP_H = 712;
const FOOT_OBS_H = 890;
const FOOT_SIG_ROW_H = 290;
const FOOT_SIG_SEAL_H = 890;
const FOOT_V_RATIO = 0.72; // ancho bloque V vs VI
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
const ST_DATA_FONT_SIZE = BODY_DATA_SIZE; // Arial 10 — datos desde BD en tabla III/IV
const ST_DATA_ROW_MIN = 412; // altura mínima fila alumno (UEH: 412)
const ST_DATA_CELL_PAD = 0;
const ST_DATA_CELL_PAD_LEFT = 40; // padding izquierdo filas de datos
const ST_EMPTY = "***";
const ST_EMPTY_SHORT = "*"; // EF, SEXO, DIA, MES, AÑO
const W_LBL_ANO = 1580;
const W_LBL_TIPO = 1800; // "Tipo de Evaluación:" en una sola línea
const W_LINE_TIPO = 700; // línea corta solo para "Final"
const W_LBL_MES = 1500;
const W_LBL_COL0 = 1800; // columna 0 cabecera (≥ W_LBL_ANO y W_LBL_TIPO)

// Altura de referencia calibrada para ~9 materias en Área Común
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
};

function rowH(layout: SheetLayout, baseHeight: number, minHeight = 180): number {
  return Math.max(minHeight, Math.round(baseHeight * layout.vScale));
}

function estimateProfesoresBlockHeight(nRegular: number, nProductive: number): number {
  const profH = FOOT_V_HDR_H * 2 + (nRegular + nProductive) * FOOT_V_DATA_H;
  const cursoH = FOOT_V_HDR_H + 6 * FOOT_V_DATA_H;
  return Math.max(profH, cursoH);
}

function estimateContentHeightTwips(nRegular: number, nProductive: number): number {
  return (
    HEADER_BLOCK_ESTIMATE +
    INSTITUTION_BLOCK_ESTIMATE +
    ST_TABLE_GAP +
    ST_TITLE_ROW_MIN +
    ST_IV_HDR_ROW1 +
    ST_IV_HDR_ROW2 +
    ST_IV_HDR_ROW3 +
    ST_IV_HDR_ROW4 +
    ST_ROWS_PER_PAGE * ST_DATA_ROW_MIN +
    5 * FOOT_TOTAL_ROW_H +
    estimateProfesoresBlockHeight(nRegular, nProductive) +
    FOOT_OBS_H +
    6 * FOOT_SIG_ROW_H +
    FOOT_SIG_SEAL_H
  );
}

function computeVerticalScale(nRegular: number, nProductive: number): number {
  const usable = PAGE_H - MARGIN_TOP - MARGIN_BOTTOM;
  const fixed = HEADER_BLOCK_ESTIMATE + INSTITUTION_BLOCK_ESTIMATE + ST_TABLE_GAP;
  const total = estimateContentHeightTwips(nRegular, nProductive);
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
  const [lineDir, lineTel] = distributeLineWidths(contentW - fixed, [0.823, 0.177]);
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
  const [lineDir, lineCed] = distributeLineWidths(contentW - fixed, [0.703, 0.297]);
  return [950, lineDir, 500, 1600, lineCed];
}

function computeSheetLayout(data: ResumenFinalDocxData): SheetLayout {
  const nRegular = data.regularSubjects.length;
  const nProductive = data.productiveSubjects.length;
  const vScale = computeVerticalScale(nRegular, nProductive);
  const stIiiCols = [...ST_III_COLS];
  const stColIii = ST_COL_III_FIXED;
  const stIvCols = [
    ...Array(nRegular).fill(IV_MATERIA_W),
    ...Array(nProductive).fill(IV_PRODUCTIVE_W),
  ];
  const stColIv = stIvCols.reduce((a, b) => a + b, 0);
  const contentW = stColIii + stColIv;
  const pageW = contentW + MARGIN_LEFT + MARGIN_RIGHT;

  return {
    pageW,
    pageH: PAGE_H,
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
  };
}

function ivColSpanW(layout: SheetLayout, start: number, count: number): number {
  return layout.stIvCols.slice(start, start + count).reduce((a, b) => a + b, 0);
}

function iiiSpanW(layout: SheetLayout, start: number, count: number): number {
  return layout.stIiiCols.slice(start, start + count).reduce((a, b) => a + b, 0);
}

function padTotal(n: number): string {
  return String(n).padStart(2, "0");
}

function gradeLabelUpper(gradeLevel: string): string {
  return (GRADE_LABELS[gradeLevel] ?? gradeLevel).toUpperCase();
}

function remisionDateFromYearRange(yearRange: string): string {
  const match = yearRange.match(/(\d{4})\s*[-–/]\s*(\d{4})/);
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

function scaleFooterCols(base: number[], targetW: number): number[] {
  const sum = base.reduce((a, b) => a + b, 0);
  const scaled = base.map((w) => Math.round((w * targetW) / sum));
  const diff = targetW - scaled.reduce((a, b) => a + b, 0);
  scaled[scaled.length - 1] += diff;
  return scaled;
}

function buildTotalRows(
  data: ResumenFinalDocxData,
  layout: SheetLayout,
): TableRow[] {
  const titleW = iiiSpanW(layout, 0, 5);
  const labelW = iiiSpanW(layout, 5, 5);
  const items: { label: string; value: number }[] = [
    { label: "Inscritos", value: data.inscritos },
    { label: "Inasistentes", value: data.inasistentes },
    { label: "Aprobados", value: data.aprobados },
    { label: "No Aprobados", value: data.noAprobados },
    { label: "No Cursantes", value: data.noCursaron },
  ];

  return items.map((item, i) =>
    mkStHdrRow(
      [
        ...(i === 0
          ? [
              mkStHdrCell(titleW, "Total de Áreas de Formación", {
                rowSpan: 5,
                columnSpan: 5,
              }),
            ]
          : []),
        mkStHdrCell(labelW, item.label, { columnSpan: 5 }),
        mkStHdrCell(layout.stColIv, padTotal(item.value), {
          columnSpan: layout.nIvCols,
        }),
      ],
      rowH(layout, FOOT_TOTAL_ROW_H),
    ),
  );
}

function buildProfesoresTable(
  data: ResumenFinalDocxData,
  tableW: number,
  layout: SheetLayout,
): Table {
  const vCols = scaleFooterCols([280, 380, 1500, 2800, 1200, 900], tableW);
  const subjects = data.regularSubjects;

  const mkProfRow = (
    nro: string,
    code: string,
    area: string,
    teacher: string,
    cedula: string,
    minH: number,
    areaMultiline = false,
  ) =>
    mkStHdrRow(
      [
        mkFooterDataCell(vCols[0], nro, { align: AlignmentType.CENTER }),
        mkFooterDataCell(vCols[1], code, { align: AlignmentType.CENTER }),
        areaMultiline
          ? new TableCell({
              width: { size: vCols[2], type: WidthType.DXA },
              children: tblPMulti(area, false),
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 4, bottom: 4, left: 4, right: 4 },
            })
          : mkFooterDataCell(vCols[2], area),
        mkFooterDataCell(vCols[3], teacher),
        mkFooterDataCell(vCols[4], cedula, { align: AlignmentType.CENTER }),
        mkFooterDataCell(vCols[5], ""),
      ],
      minH,
    );

  return new Table({
    width: { size: tableW, type: WidthType.DXA },
    columnWidths: vCols,
    layout: TableLayoutType.FIXED,
    borders: BORDERS_GRID,
    rows: [
      mkStHdrRow(
        [
          new TableCell({
            columnSpan: 6,
            width: { size: tableW, type: WidthType.DXA },
            children: [tblFooterP("V. Profesores por Áreas:", { bold: true })],
            margins: { top: 4, bottom: 4, left: 6, right: 4 },
          }),
        ],
        rowH(layout, FOOT_V_HDR_H),
      ),
      mkStHdrRow(
        [
          mkFooterDataCell(vCols[0], "N°", { bold: true, align: AlignmentType.CENTER }),
          mkFooterDataCell(vCols[1], "", { bold: true }),
          mkFooterDataCell(vCols[2], "Áreas de Formación", { bold: true }),
          mkFooterDataCell(vCols[3], "Apellidos y Nombres del Profesor", {
            bold: true,
          }),
          mkFooterDataCell(vCols[4], "Cedula de Identidad", {
            bold: true,
            align: AlignmentType.CENTER,
          }),
          mkFooterDataCell(vCols[5], "Firma", {
            bold: true,
            align: AlignmentType.CENTER,
          }),
        ],
        rowH(layout, FOOT_V_HDR_H),
      ),
      ...subjects.map((s, i) =>
        mkProfRow(
          String(i + 1),
          s.abbreviation.toUpperCase(),
          s.name.toUpperCase(),
          s.teacherName,
          s.teacherCedula,
          rowH(layout, FOOT_V_DATA_H),
        ),
      ),
      ...data.productiveSubjects.map((s, i) =>
        mkProfRow(
          String(subjects.length + i + 1),
          s.abbreviation.toUpperCase(),
          s.name.toUpperCase(),
          s.teacherName,
          s.teacherCedula,
          rowH(layout, FOOT_V_DATA_H),
        ),
      ),
    ],
  });
}

function buildCursoTable(
  data: ResumenFinalDocxData,
  tableW: number,
  layout: SheetLayout,
): Table {
  const viCols = [Math.round(tableW * 0.42), tableW - Math.round(tableW * 0.42)];
  const rows: [string, string][] = [
    ["PLAN DE ESTUDIO", "EDUCACIÓN MEDIA GENERAL"],
    ["CÓDIGO", ""],
    ["AÑO CURSADO", gradeLabelUpper(data.sectionGradeLevel)],
    ["SECCIÓN", data.sectionName.toUpperCase()],
    ["N° DE ESTUDIANTES POR SECCIÓN", String(data.totalStudentsInSection)],
    ["N° DE ESTUDIANTES EN LA PÁGINA", String(data.studentsInPage)],
  ];

  return new Table({
    width: { size: tableW, type: WidthType.DXA },
    columnWidths: viCols,
    layout: TableLayoutType.FIXED,
    borders: BORDERS_GRID,
    rows: [
      mkStHdrRow(
        [
          new TableCell({
            columnSpan: 2,
            width: { size: tableW, type: WidthType.DXA },
            children: [
              tblFooterP("VI. Identificación del Curso:", { bold: true }),
            ],
            margins: { top: 4, bottom: 4, left: 6, right: 4 },
          }),
        ],
        rowH(layout, FOOT_V_HDR_H),
      ),
      ...rows.map(([lbl, val]) =>
        mkStHdrRow(
          [
            mkFooterDataCell(viCols[0], lbl, { bold: true }),
            mkFooterDataCell(viCols[1], val),
          ],
          rowH(layout, FOOT_V_DATA_H),
        ),
      ),
    ],
  });
}

function buildProfesoresCursoRow(
  data: ResumenFinalDocxData,
  layout: SheetLayout,
): TableRow {
  const vW = Math.round(layout.stTableW * FOOT_V_RATIO);
  const viW = layout.stTableW - vW;

  return mkFooterSpanCell(layout, [
    new Table({
      width: { size: layout.stTableW, type: WidthType.DXA },
      columnWidths: [vW, viW],
      layout: TableLayoutType.FIXED,
      borders: BORDERS_NONE,
      rows: [
        mkRow([
          new TableCell({
            width: { size: vW, type: WidthType.DXA },
            children: [buildProfesoresTable(data, vW, layout)],
            borders: BORDERS_NONE,
            margins: { top: 0, bottom: 0, left: 0, right: 4 },
          }),
          new TableCell({
            width: { size: viW, type: WidthType.DXA },
            children: [buildCursoTable(data, viW, layout)],
            borders: BORDERS_NONE,
            margins: { top: 0, bottom: 0, left: 4, right: 0 },
          }),
        ]),
      ],
    }),
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
      tblFooterP("VII. Observaciones:", { bold: true }),
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
    multiline?: string;
  },
): TableCell {
  return new TableCell({
    ...(opts?.rowSpan ? { rowSpan: opts.rowSpan } : {}),
    width: { size: w, type: WidthType.DXA },
    children: opts?.multiline
      ? tblPMulti(opts.multiline, opts.bold ?? false)
      : [tblFooterP(text, { bold: opts?.bold })],
    verticalAlign: VerticalAlign.TOP,
    margins: { top: 6, bottom: 4, left: 6, right: 4 },
  });
}

function buildFirmasBlock(
  data: ResumenFinalDocxData,
  tableW: number,
  layout: SheetLayout,
): Table {
  const h = data.schoolHeader;
  const remision = remisionDateFromYearRange(data.yearRange);
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
    borders: BORDERS_GRID,
    rows: [
      mkStHdrRow(
        [
          mkSigCell(cols[0], `VIII. Fecha de Remisión: ${remision}`, {
            bold: true,
          }),
          mkSigCell(cols[1], "", {
            rowSpan: 7,
            multiline: "SELLO DE LA\nINSTITUCIÓN\nEDUCATIVA",
          }),
          mkSigCell(cols[2], "IX. Fecha de Recepción:", { bold: true }),
          mkSigCell(cols[3], "", {
            rowSpan: 7,
            multiline:
              "SELLO DEL CENTRO DE DESARROLLO DE LA CALIDAD EDUCATIVA ESTATAL",
          }),
        ],
        rowH(layout, FOOT_SIG_ROW_H),
      ),
      mkStHdrRow(
        [
          mkSigCell(cols[0], "Director(a)"),
          mkSigCell(cols[2], "Funcionario Receptor"),
        ],
        rowH(layout, FOOT_SIG_ROW_H),
      ),
      mkStHdrRow(
        [
          mkSigCell(cols[0], "Apellidos y Nombres:"),
          mkSigCell(cols[2], "Apellidos y Nombres:"),
        ],
        rowH(layout, FOOT_SIG_ROW_H),
      ),
      mkStHdrRow(
        [mkSigCell(cols[0], director), mkSigCell(cols[2], "")],
        rowH(layout, FOOT_SIG_ROW_H),
      ),
      mkStHdrRow(
        [
          mkSigCell(cols[0], "Cédula de Identidad"),
          mkSigCell(cols[2], "Cédula de Identidad"),
        ],
        rowH(layout, FOOT_SIG_ROW_H),
      ),
      mkStHdrRow(
        [mkSigCell(cols[0], cedulaDir), mkSigCell(cols[2], "")],
        rowH(layout, FOOT_SIG_ROW_H),
      ),
      mkStHdrRow(
        [mkSigCell(cols[0], "Firma:"), mkSigCell(cols[2], "Firma:")],
        rowH(layout, FOOT_SIG_SEAL_H, 400),
      ),
    ],
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
    mkFooterSpanCell(layout, [buildFirmasBlock(data, layout.stTableW, layout)]),
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
  const match = yearRange.match(/(\d{4})\s*[-–/]\s*(\d{4})/);
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

function logoImageSize(
  cellWidthTwips: number,
  logoBuffer: ArrayBuffer,
  maxHeightPx = LOGO_MAX_HEIGHT_PX,
): { width: number; height: number } {
  const widthPx = twipsToImagePx(cellWidthTwips);
  const dims = getPngDimensions(logoBuffer);
  if (!dims?.width || !dims?.height)
    return { width: widthPx, height: Math.round(widthPx * 0.15) };

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
  vertCompact?: boolean; // EF, SEXO, DIA, MES, AÑO
  verticalMerge?: (typeof VerticalMergeType)[keyof typeof VerticalMergeType];
};

function mkStHdrCell(w: number, text: string, opts?: StHdrCellOpts): TableCell {
  const children = opts?.multiline
    ? tblPMulti(opts.multiline)
    : opts?.vertical
      ? tblPVertical(text, ST_HDR_VERT_LINE)
      : [tblP(text, { bold: true, size: ST_HDR_FONT_SIZE })];

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

function formatStField(value: string, empty = ST_EMPTY): string {
  const v = (value ?? "").trim();
  return v ? v.toUpperCase() : empty;
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
        spacing: { before: 0, after: 0, line: 200, lineRule: "exact" as const },
      }),
    ],
    verticalAlign: VerticalAlign.CENTER,
    margins: {
      top: ST_DATA_CELL_PAD,
      bottom: ST_DATA_CELL_PAD,
      left: align === AlignmentType.CENTER ? 0 : ST_DATA_CELL_PAD_LEFT,
      right: 0,
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

  return mkStHdrRow(
    [
      mkStDataCell(ST_III_NRO, formatStNro(row.nro)),
      mkStDataCell(ST_III_CED, formatStField(row.cedula)),
      mkStDataCell(ST_III_APE, formatStField(row.apellidos)),
      mkStDataCell(ST_III_NOM, formatStField(row.nombres)),
      mkStDataCell(ST_III_LUG, formatStField(row.lugarNacimiento)),
      mkStDataCell(
        ST_III_EF,
        formatStField(row.entidadFederal, ST_EMPTY_SHORT),
      ),
      mkStDataCell(ST_III_SEX, formatStField(row.sexo, ST_EMPTY_SHORT)),
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
    ],
    rowH(layout, ST_DATA_ROW_MIN, 280),
  );
}

function buildEstudiantesBlock(
  data: ResumenFinalDocxData,
  layout: SheetLayout,
): Table {
  const { nRegular, nProductive, nIvCols } = layout;
  const regularSubjects = data.regularSubjects;
  const productiveSubjects = data.productiveSubjects;
  const padded = padStudentsPage(data.students);
  const dataRows = padded.map((row, idx) =>
    mkStDataRow(row, layout, regularSubjects, productiveSubjects, idx >= data.students.length),
  );

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
            "III: Identificación del Estudiante",
            "left",
            layout.stIiiCols.length,
          ),
          mkStTitleCell(
            layout.stColIv,
            "IV: Resumen Final del Rendimiento",
            "right",
            nIvCols,
          ),
        ],
        rowH(layout, ST_TITLE_ROW_MIN, 280),
      ),
      mkStHdrRow(
        [
          mkStHdrCell(ST_III_NRO, "N°", { rowSpan: III_HDR_ROW_SPAN }),
          mkStHdrCell(ST_III_CED, "", {
            rowSpan: III_HDR_ROW_SPAN,
            multiline: "Cédula de\nidentidad",
          }),
          mkStHdrCell(ST_III_APE, "Apellidos", { rowSpan: III_HDR_ROW_SPAN }),
          mkStHdrCell(ST_III_NOM, "Nombres", { rowSpan: III_HDR_ROW_SPAN }),
          mkStHdrCell(ST_III_LUG, "", {
            rowSpan: III_HDR_ROW_SPAN,
            multiline: "Lugar de\nnacimiento",
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
            multiline: "Fecha de\nnacimiento",
          }),
          mkStHdrCell(ivColSpanW(layout, 0, nIvCols), "ÁREAS DE FORMACIÓN", {
            columnSpan: nIvCols,
          }),
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
          mkStHdrCell(ST_III_ANO, "AÑO", {
            rowSpan: FECHA_SUB_ROW_SPAN,
            vertical: true,
            vertCompact: true,
          }),
          mkStHdrCell(ivColSpanW(layout, 0, nRegular), "COMPONENTE GENERAL", {
            columnSpan: nRegular,
          }),
          ...(nProductive > 0
            ? [mkStHdrCell(ivColSpanW(layout, nRegular, nProductive), "COMPONENTE PRODUCTIVO", {
                columnSpan: nProductive,
              })]
            : []),
        ],
        rowH(layout, ST_IV_HDR_ROW2, 280),
      ),
      mkStHdrRow(
        [
          ...regularSubjects.map((_, i) =>
            mkStHdrCell(layout.stIvCols[i], String(i + 1)),
          ),
          ...productiveSubjects.map((_, i) =>
            mkStHdrCell(layout.stIvCols[nRegular + i], String(nRegular + i + 1)),
          ),
        ],
        rowH(layout, ST_IV_HDR_ROW3, 260),
      ),
      mkStHdrRow(
        [
          ...regularSubjects.map((s, i) =>
            mkStHdrCell(layout.stIvCols[i], s.abbreviation.toUpperCase()),
          ),
          ...productiveSubjects.map((s, i) =>
            mkStHdrCell(layout.stIvCols[nRegular + i], s.abbreviation.toUpperCase()),
          ),
        ],
        rowH(layout, ST_IV_HDR_ROW4, 280),
      ),
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
  const logoSize = logoBuffer ? logoImageSize(leftW, logoBuffer, logoMaxH) : null;
  const logoCell = new TableCell({
    width: { size: leftW, type: WidthType.DXA },
    children:
      logoBuffer && logoSize
        ? [
            new Paragraph({
              children: [
                new ImageRun({
                  type: "png",
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
    margins: { top: 0, bottom: 0, left: 0, right: 20 },
  });

  const wLineMes = rightInnerW - W_LBL_COL0 - W_LINE_TIPO - W_LBL_MES;
  const wLineAnoSpan = W_LINE_TIPO + W_LBL_MES + wLineMes;
  const fieldColWidths = [W_LBL_COL0, W_LINE_TIPO, W_LBL_MES, wLineMes];

  const fieldsTable = mkFixedTable(
    [
      mkRow([
        mkLabelCell(W_LBL_COL0, "I. AÑO Escolar:", 1, true),
        mkBottomLineCell(wLineAnoSpan, data.yearRange, 3),
      ]),
      mkRow([
        mkLabelCell(W_LBL_COL0, "Tipo de Evaluación:", 1, true),
        mkBottomLineCell(W_LINE_TIPO, "Final"),
        mkLabelCell(W_LBL_MES, "     Mes y AÑO:", 1, true),
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
              t("RESUMEN FINAL DEL RENDIMIENTO ESTUDIANTIL", {
                size: HDR_TITLE_SIZE,
                bold: true,
                underline: true,
              }),
              AlignmentType.CENTER,
            ),
            hdrP(
              t(`Código del Formato: EMG ${data.tipoPlanilla}`, {
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
              t("II. Datos de la Institución Educativa:", {
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
        mkIeLabelCell(ie[0], "Código de la Institución Educativa:"),
        mkIeLineCell(ie[1], h.codigo_plantel ?? ""),
        mkIeSpacerCell(ie[2]),
        mkIeLabelCell(ie[3], "Epónimo:"),
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
                  mkIeLabelCell(ieDir[0], "Dirección:", ieGap),
                  mkIeLineCell(
                    ieDir[1],
                    h.direccion_plantel ?? "",
                    BODY_DATA_SIZE,
                    ieGap,
                  ),
                  mkIeSpacerCell(ieDir[2], ieGap),
                  mkIeLabelCell(ieDir[3], "Teléfono:", ieGap),
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
                  mkIeLabelCell(ieCed[3], "Cédula de identidad:", ieGap),
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
    ...(ST_TABLE_GAP > 0 ? [mkCompactGap(Math.round(ST_TABLE_GAP * layout.vScale))] : []),
    buildEstudiantesBlock(data, layout),
  ];
}

export async function generateResumenFinal31059Docx(
  sections: ResumenFinalDocxData | ResumenFinalDocxData[],
): Promise<Blob> {
  const dataArray = Array.isArray(sections) ? sections : [sections];

  let logoBuffer: ArrayBuffer | null = null;
  try {
    const res = await fetch(LOGO_URL);
    if (res.ok) logoBuffer = await res.arrayBuffer();
  } catch {
    // sin logo
  }

  const docSections = await Promise.all(
    dataArray.map(async (data, index) => {
      const layout = computeSheetLayout(data);
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
