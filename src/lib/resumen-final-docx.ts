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
} from "docx";
import type {
  ResumenFinalDocxData,
  StudentDocxRow,
} from "@/hooks/useResumenFinalDocxData";

// ─── página (estrategia UEH: hoja virtual alta y ancha para que entre todo en una sola página lógica) ──
const PAGE_W = 18410;           // ~32.47 cm — igual que UEH referencia (última sección)
const PAGE_H = 31660;           // ~55.80 cm — igual que UEH referencia
const cmToTwips = (cm: number) => Math.round((cm / 2.54) * 1440);
const MARGIN_LEFT = 141;        // ~0.25 cm (UEH XML: w:left="141")
const MARGIN_RIGHT = 283;       // ~0.50 cm (UEH XML: w:right="283")
const MARGIN_TOP = 1760;        // ~3.10 cm (UEH XML: w:top="1760")
const MARGIN_BOTTOM = 280;      // ~0.49 cm (UEH XML: w:bottom="280")
const CONTENT_W = PAGE_W - MARGIN_LEFT - MARGIN_RIGHT; // 17986
const PARA_SPACE_BEFORE = 8;
const HDR_BLOCK_GAP = 0; // espacio logo/cabecera → sección II (usar mkCompactGap)
const ST_TABLE_GAP = 5; // espacio sección II → tabla estudiantes

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
const IE_LINE_SPACING = 175; // interlineado sección II
const IE_ROW_GAP = 34; // separación vertical entre filas sección II
const IE_TITLE_PAD_TOP = 6; // padding interno celda título II (no el hueco bajo logo)
// fila código + epónimo (5 columnas: lbl | línea | gap | lbl | línea)
const IE_LBL_COD = 2800;
const IE_LINE_COD = 1600;
const IE_GAP = 500;
const IE_LBL_EPO = 1000;
const IE_LINE_EPO = 12086; // hasta margen derecho (CONTENT_W 17986)
const IE_ROW_W = 17986; // ancho total filas sección II (= CONTENT_W)
const IE_ROW_COLS = [IE_LBL_COD, IE_LINE_COD, IE_GAP, IE_LBL_EPO, IE_LINE_EPO];
// fila dirección + gap + teléfono
const IE_LBL_DIR = 900;
const IE_LINE_DIR = 13074; // ajustado a CONTENT_W 17986
const IE_DIR_TEL_GAP = 300;
const IE_LBL_TEL = 900;
const IE_LINE_TEL = 2812; // ajustado a CONTENT_W 17986
const IE_DIR_ROW_COLS = [
  IE_LBL_DIR,
  IE_LINE_DIR,
  IE_DIR_TEL_GAP,
  IE_LBL_TEL,
  IE_LINE_TEL,
];
// fila municipio | gap | entidad federal | gap | zona educativa
const IE_LBL_MUN = 600;
const IE_LINE_MUN = 4895; // ajustado a CONTENT_W 17986
const IE_MUN_ENT_GAP = 500;
const IE_LBL_ENT = 800;
const IE_LINE_ENT = 4895; // ajustado a CONTENT_W 17986
const IE_LBL_ZONA = 900;
const IE_LINE_ZONA = 4896; // ajustado a CONTENT_W 17986
const IE_MUN_ROW_COLS = [
  IE_LBL_MUN,
  IE_LINE_MUN,
  IE_MUN_ENT_GAP,
  IE_LBL_ENT,
  IE_LINE_ENT,
  IE_MUN_ENT_GAP,
  IE_LBL_ZONA,
  IE_LINE_ZONA,
];
// fila director (a) | gap | cédula de identidad
const IE_LBL_DIRECTOR = 950;
const IE_LINE_DIRECTOR = 10500; // ajustado a CONTENT_W 17986
const IE_DIR_CED_GAP = 500;
const IE_LBL_CEDULA = 1600;
const IE_LINE_CEDULA = 4436; // ajustado a CONTENT_W 17986
const IE_DIR_CED_ROW_COLS = [
  IE_LBL_DIRECTOR,
  IE_LINE_DIRECTOR,
  IE_DIR_CED_GAP,
  IE_LBL_CEDULA,
  IE_LINE_CEDULA,
];
// ─── tabla III + IV (estudiantes) — ajustar aquí ─────────────────────
const ST_TABLE_W = 17986; // ancho total (= CONTENT_W)
const ST_COL_III = 11511; // III Identificación del Estudiante (~64%)
const ST_COL_IV = 6475; // IV Resumen Final del Rendimiento (~36%)
const ST_TABLE_FONT_SIZE = 9; // Arial 9 — solo tabla III/IV (UEH referencia)
const ST_HDR_FONT_SIZE = ST_TABLE_FONT_SIZE;
const ST_CELL_PAD = 10;
// subcolumnas III (suma = ST_COL_III = 11511)
const ST_III_NRO = 485;
const ST_III_CED = 1896;
const ST_III_APE = 2351;
const ST_III_NOM = 2350;
const ST_III_LUG = 1851;
const ST_III_EF = 561;
const ST_III_SEX = 394;
const ST_III_DIA = 508;
const ST_III_MES = 508;
const ST_III_ANO = 607;
const ST_III_FECHA_W = 1623; // ST_III_DIA + ST_III_MES + ST_III_ANO
const ST_HDR_VERT_PAD_TOP = 6;
const ST_HDR_VERT_PAD_BOTTOM = 5;
const ST_HDR_VERT_LINE = 180; // ≥ altura Arial 9pt
const ST_HDR_CELL_PAD_TOP = 14; // aire arriba (N°, Cédula, etc.)
const ST_HDR_CELL_PAD_BOTTOM = 5;
const ST_HDR_MULTILINE_BEFORE = 7; // espacio 1ª línea multilínea
const ST_HDR_ROW1_MIN = 415; // altura mín. fila N°…Fecha de nacimiento (UEH: 415)
const ST_HDR_ROW2_MIN = 465; // altura mín. fila DIA / MES / AÑO (UEH: 465)
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
const ST_ALL_COLS = [...ST_III_COLS, ST_COL_IV];
const ST_ROWS_PER_PAGE = 35;
const ST_DATA_FONT_SIZE = ST_TABLE_FONT_SIZE; // Arial 9.5, normal
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
): { width: number; height: number } {
  const widthPx = twipsToImagePx(cellWidthTwips);
  const dims = getPngDimensions(logoBuffer);
  if (!dims?.width || !dims?.height)
    return { width: widthPx, height: Math.round(widthPx * 0.15) };

  let width = widthPx;
  let height = Math.round(widthPx * (dims.height / dims.width));
  if (height > LOGO_MAX_HEIGHT_PX) {
    const scale = LOGO_MAX_HEIGHT_PX / height;
    height = LOGO_MAX_HEIGHT_PX;
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

function mkBottomLineCell(w: number, value = "", span = 1): TableCell {
  return new TableCell({
    ...(span > 1 ? { columnSpan: span } : {}),
    width: { size: w, type: WidthType.DXA },
    children: [hdrP(t(value, { size: HDR_BODY_SIZE }), AlignmentType.CENTER)],
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
    verticalAlign: VerticalAlign.CENTER,
    margins: {
      top: ST_CELL_PAD,
      bottom: ST_CELL_PAD,
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
    gcrpAssignmentId: null,
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

function mkStDataRow(row: StudentDocxRow): TableRow {
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
      mkStDataCell(ST_COL_IV, ""),
    ],
    ST_DATA_ROW_MIN,
  );
}

function buildEstudiantesBlock(data: ResumenFinalDocxData): Table {
  const dataRows = padStudentsPage(data.students).map((row) =>
    mkStDataRow(row),
  );

  return new Table({
    width: { size: ST_TABLE_W, type: WidthType.DXA },
    columnWidths: ST_ALL_COLS,
    layout: TableLayoutType.FIXED,
    borders: BORDERS_GRID,
    rows: [
      mkRow([
        mkStTitleCell(
          ST_COL_III,
          "III: Identificación del Estudiante",
          "left",
          ST_III_COLS.length,
        ),
        mkStTitleCell(ST_COL_IV, "IV: Resumen Final del Rendimiento", "right"),
      ]),
      mkStHdrRow(
        [
          mkStHdrCell(ST_III_NRO, "N°", { rowSpan: 2 }),
          mkStHdrCell(ST_III_CED, "", {
            rowSpan: 2,
            multiline: "Cédula de\nidentidad",
          }),
          mkStHdrCell(ST_III_APE, "Apellidos", { rowSpan: 2 }),
          mkStHdrCell(ST_III_NOM, "Nombres", { rowSpan: 2 }),
          mkStHdrCell(ST_III_LUG, "", {
            rowSpan: 2,
            multiline: "Lugar de\nnacimiento",
          }),
          mkStHdrCell(ST_III_EF, "EF", {
            rowSpan: 2,
            vertical: true,
            vertCompact: true,
          }),
          mkStHdrCell(ST_III_SEX, "SEXO", {
            rowSpan: 2,
            vertical: true,
            vertCompact: true,
          }),
          mkStHdrCell(ST_III_FECHA_W, "", {
            columnSpan: 3,
            multiline: "Fecha de\nnacimiento",
          }),
          mkStHdrCell(ST_COL_IV, "", { rowSpan: 2 }),
        ],
        ST_HDR_ROW1_MIN,
      ),
      mkStHdrRow(
        [
          mkStHdrCell(ST_III_DIA, "DIA", { vertical: true, vertCompact: true }),
          mkStHdrCell(ST_III_MES, "MES", { vertical: true, vertCompact: true }),
          mkStHdrCell(ST_III_ANO, "AÑO", { vertical: true, vertCompact: true }),
        ],
        ST_HDR_ROW2_MIN,
      ),
      ...dataRows,
    ],
  });
}

async function buildHeaderBlock(
  data: ResumenFinalDocxData,
  logoBuffer: ArrayBuffer | null,
): Promise<Table> {
  const leftW = Math.round(CONTENT_W * LOGO_WIDTH_RATIO);
  const rightW = CONTENT_W - leftW;
  const rightInnerW = rightW - HDR_TITLE_INDENT;

  const logoSize = logoBuffer ? logoImageSize(leftW, logoBuffer) : null;
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

  return mkFixedTable([mkRow([logoCell, rightCell])], CONTENT_W, [
    leftW,
    rightW,
  ]);
}

function buildInstitucionBlock(data: ResumenFinalDocxData): Table {
  const h = data.schoolHeader;

  return mkFixedTable(
    [
      mkRow([
        new TableCell({
          columnSpan: 5,
          width: { size: IE_ROW_W, type: WidthType.DXA },
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
            bottom: IE_ROW_GAP,
            left: 0,
            right: 0,
          },
        }),
      ]),
      mkRow([
        mkIeLabelCell(IE_LBL_COD, "Código de la Institución Educativa:"),
        mkIeLineCell(IE_LINE_COD, h.codigo_plantel ?? ""),
        mkIeSpacerCell(IE_GAP),
        mkIeLabelCell(IE_LBL_EPO, "Epónimo:"),
        mkIeLineCell(IE_LINE_EPO, h.nombre_plantel ?? ""),
      ]),
      mkRow([
        new TableCell({
          columnSpan: 5,
          width: { size: IE_ROW_W, type: WidthType.DXA },
          children: [
            mkFixedTable(
              [
                mkRow([
                  mkIeLabelCell(IE_LBL_DIR, "Dirección:", IE_ROW_GAP),
                  mkIeLineCell(
                    IE_LINE_DIR,
                    h.direccion_plantel ?? "",
                    BODY_LABEL_SIZE,
                    IE_ROW_GAP,
                  ),
                  mkIeSpacerCell(IE_DIR_TEL_GAP, IE_ROW_GAP),
                  mkIeLabelCell(IE_LBL_TEL, "Teléfono:", IE_ROW_GAP),
                  mkIeLineCell(
                    IE_LINE_TEL,
                    h.telefono_plantel ?? "",
                    BODY_DATA_SIZE,
                    IE_ROW_GAP,
                  ),
                ]),
              ],
              IE_ROW_W,
              IE_DIR_ROW_COLS,
            ),
          ],
          borders: BORDERS_NONE,
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
        }),
      ]),
      mkRow([
        new TableCell({
          columnSpan: 5,
          width: { size: IE_ROW_W, type: WidthType.DXA },
          children: [
            mkFixedTable(
              [
                mkRow([
                  mkIeLabelCell(IE_LBL_MUN, "Municipio:", IE_ROW_GAP),
                  mkIeLineCell(
                    IE_LINE_MUN,
                    h.municipio_plantel ?? "",
                    BODY_DATA_SIZE,
                    IE_ROW_GAP,
                  ),
                  mkIeSpacerCell(IE_MUN_ENT_GAP, IE_ROW_GAP),
                  mkIeLabelCell(IE_LBL_ENT, "Entidad federal:", IE_ROW_GAP),
                  mkIeLineCell(
                    IE_LINE_ENT,
                    h.entidad_federal ?? "",
                    BODY_DATA_SIZE,
                    IE_ROW_GAP,
                  ),
                  mkIeSpacerCell(IE_MUN_ENT_GAP, IE_ROW_GAP),
                  mkIeLabelCell(IE_LBL_ZONA, "Zona Educativa:", IE_ROW_GAP),
                  mkIeLineCell(
                    IE_LINE_ZONA,
                    h.zona_educativa ?? "",
                    BODY_DATA_SIZE,
                    IE_ROW_GAP,
                  ),
                ]),
              ],
              IE_ROW_W,
              IE_MUN_ROW_COLS,
            ),
          ],
          borders: BORDERS_NONE,
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
        }),
      ]),
      mkRow([
        new TableCell({
          columnSpan: 5,
          width: { size: IE_ROW_W, type: WidthType.DXA },
          children: [
            mkFixedTable(
              [
                mkRow([
                  mkIeLabelCell(IE_LBL_DIRECTOR, "Director (a):", IE_ROW_GAP),
                  mkIeLineCell(
                    IE_LINE_DIRECTOR,
                    h.director ?? "",
                    BODY_DATA_SIZE,
                    IE_ROW_GAP,
                  ),
                  mkIeSpacerCell(IE_DIR_CED_GAP, IE_ROW_GAP),
                  mkIeLabelCell(
                    IE_LBL_CEDULA,
                    "Cédula de identidad:",
                    IE_ROW_GAP,
                  ),
                  mkIeLineCell(
                    IE_LINE_CEDULA,
                    h.cedula_director ?? "",
                    BODY_DATA_SIZE,
                    IE_ROW_GAP,
                  ),
                ]),
              ],
              IE_ROW_W,
              IE_DIR_CED_ROW_COLS,
            ),
          ],
          borders: BORDERS_NONE,
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
        }),
      ]),
    ],
    IE_ROW_W,
    IE_ROW_COLS,
  );
}

async function buildDocumentContent(
  data: ResumenFinalDocxData,
  logoBuffer: ArrayBuffer | null,
): Promise<(Paragraph | Table)[]> {
  return [
    await buildHeaderBlock(data, logoBuffer),
    ...(HDR_BLOCK_GAP > 0 ? [mkCompactGap(HDR_BLOCK_GAP)] : []),
    buildInstitucionBlock(data),
    ...(ST_TABLE_GAP > 0 ? [mkCompactGap(ST_TABLE_GAP)] : []),
    buildEstudiantesBlock(data),
  ];
}

export async function generateResumenFinalDocx(
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
    dataArray.map(async (data, index) => ({
      properties: {
        ...(index > 0 ? { type: SectionType.NEXT_PAGE } : {}),
        page: {
          size: { width: PAGE_W, height: PAGE_H },
          margin: {
            top: MARGIN_TOP,
            bottom: MARGIN_BOTTOM,
            left: MARGIN_LEFT,
            right: MARGIN_RIGHT,
          },
        },
      },
      children: await buildDocumentContent(data, logoBuffer),
    })),
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
