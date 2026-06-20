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
} from "docx";
import type { ResumenFinalDocxData } from "@/hooks/useResumenFinalDocxData";

// ─── página Oficio (21.59 × 35.56 cm) ───────────────────────────────
const PAGE_W = 12240;
const PAGE_H = 20160;
const cmToTwips = (cm: number) => Math.round((cm / 2.54) * 1440);
const MARGIN_LR = cmToTwips(0.5);
const MARGIN_TOP = cmToTwips(1.27);
const MARGIN_BOTTOM = MARGIN_LR;
const CONTENT_W = PAGE_W - MARGIN_LR * 2;
const PARA_SPACE_BEFORE = 16; // 0.8 pt
const PARA_SPACE_AFTER = 0;

// ─── cabecera — ajustar aquí ─────────────────────────────────────────
const LOGO_URL =
  "https://satescolar.s3.us-east-1.amazonaws.com/planillas/LOGO+ANTERIOR.png";
const LOGO_WIDTH_RATIO = 0.4;
const HDR_TITLE_INDENT = 200;
const HDR_FONT = "Arial";
const HDR_TITLE_SIZE = 9;
const HDR_BODY_SIZE = 9;
const HDR_LINE_SPACING = 200;
const BODY_LABEL_SIZE = 9; // títulos / etiquetas
const BODY_DATA_SIZE = 10; // datos desde BD
const IE_LINE_SPACING = 180; // interlineado compacto sección II
const IE_ROW_GAP = 68; // separación vertical entre filas (~1.2 mm)
// fila código + epónimo (5 columnas: lbl | línea | gap | lbl | línea)
const IE_LBL_COD = 2800;
const IE_LINE_COD = 1600;
const IE_GAP = 500;
const IE_LBL_EPO = 1000;
const IE_LINE_EPO = 5774; // hasta margen derecho
const IE_ROW_W = 11674; // ancho total filas sección II (= CONTENT_W)
const IE_ROW_COLS = [IE_LBL_COD, IE_LINE_COD, IE_GAP, IE_LBL_EPO, IE_LINE_EPO];
// fila dirección + gap + teléfono
const IE_LBL_DIR = 900;
const IE_LINE_DIR = 7926;
const IE_DIR_TEL_GAP = 300;
const IE_LBL_TEL = 900;
const IE_LINE_TEL = 1648; // hasta margen derecho
const IE_DIR_ROW_COLS = [
  IE_LBL_DIR,
  IE_LINE_DIR,
  IE_DIR_TEL_GAP,
  IE_LBL_TEL,
  IE_LINE_TEL,
];
// fila municipio | gap | entidad federal | gap | zona educativa
const IE_LBL_MUN = 600;
const IE_LINE_MUN = 1000;
const IE_MUN_ENT_GAP = 500;
const IE_LBL_ENT = 800;
const IE_LINE_ENT = 1500;
const IE_LBL_ZONA = 900;
const IE_LINE_ZONA = 1500;
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
const IE_LINE_DIRECTOR = 4766;
const IE_DIR_CED_GAP = 500;
const IE_LBL_CEDULA = 1600;
const IE_LINE_CEDULA = 2000;
const IE_DIR_CED_ROW_COLS = [
  IE_LBL_DIRECTOR,
  IE_LINE_DIRECTOR,
  IE_DIR_CED_GAP,
  IE_LBL_CEDULA,
  IE_LINE_CEDULA,
];
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
  return {
    width: widthPx,
    height: Math.round(widthPx * (dims.height / dims.width)),
  };
}

function mkRow(cells: TableCell[]): TableRow {
  return new TableRow({ children: cells });
}

function mkFixedTable(
  rows: TableRow[],
  tableWidth: number,
  columnWidths: number[],
): Table {
  return new Table({
    width: { size: tableWidth, type: WidthType.DXA },
    columnWidths,
    layout: TableLayoutType.FIXED,
    rows,
    borders: BORDERS_NONE,
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

function mkLabelCell(w: number, text: string, span = 1): TableCell {
  return new TableCell({
    ...(span > 1 ? { columnSpan: span } : {}),
    width: { size: w, type: WidthType.DXA },
    children: [hdrP(t(text, { size: HDR_BODY_SIZE }))],
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
        mkLabelCell(W_LBL_COL0, "I. AÑO Escolar:"),
        mkBottomLineCell(wLineAnoSpan, data.yearRange, 3),
      ]),
      mkRow([
        mkLabelCell(W_LBL_COL0, "Tipo de Evaluación:"),
        mkBottomLineCell(W_LINE_TIPO, "Final"),
        mkLabelCell(W_LBL_MES, "     Mes y AÑO:"),
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
                underline: true,
              }),
              AlignmentType.CENTER,
            ),
            hdrP(
              t(`Código del Formato: EMG ${data.tipoPlanilla}`, {
                size: HDR_BODY_SIZE,
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
          margins: { top: 40, bottom: IE_ROW_GAP, left: 0, right: 0 },
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
    new Paragraph({ spacing: { before: 40, after: 0 } }),
    buildInstitucionBlock(data),
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
            left: MARGIN_LR,
            right: MARGIN_LR,
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
