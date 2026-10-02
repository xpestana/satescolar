import {
  AlignmentType,
  BorderStyle,
  Document,
  HeightRule,
  ImageRun,
  Packer,
  Paragraph,
  SectionType,
  Tab,
  TabStopType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  UnderlineType,
  VerticalAlign,
  WidthType,
} from "docx";
import logoMppeNuevo from "@/assets/logo-mppe-nuevo.jpg";
import type {
  PrimariaStudentRow,
  ResumenFinalPrimariaDocxData,
} from "@/hooks/useResumenFinalPrimariaDocxData";
import { detectImageType, getImageDimensions } from "@/lib/resumen-final-docx-base";
import { PRIMARY_ROWS_PER_PART } from "@/lib/resumen-final-level";
import {
  PRIMARIA_LITERALS,
  primariaFechaRemision,
  primariaGradeOrdinal,
  primariaMesAnioEvaluacion,
} from "@/lib/resumen-final-primaria";

// ── Planilla RR-DEA-06-04 (Educación Primaria). Medidas tomadas del formato oficial (.docx) ──
const PAGE_W = 14460; // 25.5 cm
const PAGE_H = 20980; // 37 cm
const MARGIN_TOP = 540;
const MARGIN_BOTTOM = 280;
const MARGIN_LEFT = 292; // 141 de página + 151 de sangría de la tabla original
const CONTENT_W = 13646; // ancho total de la tabla del formato
const MARGIN_RIGHT = PAGE_W - MARGIN_LEFT - CONTENT_W;

const FONT = "Arial";
const SIZE = 10; // Arial 10, igual que bachillerato
const SIZE_SMALL = 9;

// Rejilla de 18 columnas del formato original (twips).
const GRID = [340, 2834, 510, 2777, 793, 453, 623, 396, 339, 736, 339, 396, 509, 509, 509, 509, 509, 565];
const C = {
  NRO: 0,
  CED: 1,
  LUG: 2, // 3 columnas
  EF: 5,
  SEX: 6,
  DIA: 7, // 2 columnas
  MES: 9,
  ANO: 10, // 2 columnas
  LIT: 12, // A..E = 12..16
  P: 17,
} as const;

const ROW_HDR_H = 325;
const ROW_DATA_H = 268;
const ROW_TOTAL_H = 381;
const ROW_DOCENTE_H = 665;

const EMPTY_TEXT = "***";
const EMPTY_SHORT = "*";

const LOGO_W_PX = 360;
const LOGO_MAX_H_PX = 64;

type Align = (typeof AlignmentType)[keyof typeof AlignmentType];

const LINE = { style: BorderStyle.SINGLE, size: 6, color: "000000" } as const;
const NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } as const;
const BORDERS_GRID = {
  top: LINE, bottom: LINE, left: LINE, right: LINE, insideHorizontal: LINE, insideVertical: LINE,
};
const BORDERS_NONE = {
  top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE,
};
const CELL_NONE = { top: NONE, bottom: NONE, left: NONE, right: NONE };
const CELL_UNDERLINE = { top: NONE, left: NONE, right: NONE, bottom: LINE };

type RunOpts = { bold?: boolean; size?: number; underline?: boolean; /** Tabulación antes del texto. */ tab?: boolean };

function run(text: string, opts: RunOpts = {}): TextRun {
  return new TextRun({
    ...(opts.tab ? { children: [new Tab(), text] } : { text }),
    font: FONT,
    size: (opts.size ?? SIZE) * 2,
    bold: opts.bold ?? false,
    underline: opts.underline ? { type: UnderlineType.SINGLE } : undefined,
  });
}

function para(children: TextRun[], align: Align = AlignmentType.LEFT, line = 228): Paragraph {
  return new Paragraph({
    children,
    alignment: align,
    spacing: { before: 0, after: 0, line, lineRule: "exact" as const },
  });
}

function spanW(start: number, count: number): number {
  return GRID.slice(start, start + count).reduce((a, b) => a + b, 0);
}

type CellOpts = {
  span?: number;
  rowSpan?: number;
  bold?: boolean;
  size?: number;
  align?: Align;
  valign?: (typeof VerticalAlign)[keyof typeof VerticalAlign];
};

/** Celda de la tabla principal (bordes de la tabla, texto Arial 10). */
function cell(start: number, text: string | string[], opts: CellOpts = {}): TableCell {
  const span = opts.span ?? 1;
  const lines = Array.isArray(text) ? text : [text];
  return new TableCell({
    width: { size: spanW(start, span), type: WidthType.DXA },
    ...(span > 1 ? { columnSpan: span } : {}),
    ...(opts.rowSpan ? { rowSpan: opts.rowSpan } : {}),
    children: lines.map((l) =>
      para([run(l, { bold: opts.bold, size: opts.size })], opts.align ?? AlignmentType.LEFT, 230),
    ),
    verticalAlign: opts.valign ?? VerticalAlign.CENTER,
    margins: { top: 0, bottom: 0, left: 40, right: 20 },
  });
}

function row(cells: TableCell[], height: number): TableRow {
  return new TableRow({ children: cells, height: { value: height, rule: HeightRule.ATLEAST } });
}

function fixedTable(
  rows: TableRow[],
  widths: number[],
  borders: typeof BORDERS_NONE | typeof BORDERS_GRID = BORDERS_NONE,
): Table {
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders,
    rows,
  });
}

function pad2(v: string): string {
  const s = String(v ?? "").trim();
  return /^\d$/.test(s) ? `0${s}` : s;
}

function orEmpty(v: string, empty = EMPTY_TEXT): string {
  const s = String(v ?? "").trim();
  return s || empty;
}

// ── Cabecera: logo + título del formato ─────────────────────────────────────────────

const HDR_COLS = [5600, 5400, CONTENT_W - 5600 - 5400];

function buildLogoParagraph(logo: ArrayBuffer | null): Paragraph {
  if (!logo) return para([run("MINISTERIO DEL PODER POPULAR PARA LA EDUCACIÓN", { bold: true, size: 8 })]);
  const dims = getImageDimensions(logo);
  let width = LOGO_W_PX;
  let height = dims ? Math.round(LOGO_W_PX * (dims.height / dims.width)) : 60;
  if (height > LOGO_MAX_H_PX) {
    width = Math.round(width * (LOGO_MAX_H_PX / height));
    height = LOGO_MAX_H_PX;
  }
  return new Paragraph({
    children: [new ImageRun({ type: detectImageType(logo), data: logo, transformation: { width, height } })],
    spacing: { before: 0, after: 0 },
  });
}

function buildHeader(data: ResumenFinalPrimariaDocxData, logo: ArrayBuffer | null): Table {
  const titleLines = [
    para([run("RESUMEN FINAL DE LA EVALUACIÓN", { bold: true, underline: true })], AlignmentType.CENTER, 210),
    para([run("(Educación Básica, 1º a 6º grado)", { bold: true })], AlignmentType.CENTER, 195),
    para([run("Código del Formato: RR-DEA-06-04", { bold: true })], AlignmentType.CENTER, 195),
    para([run(`I. Plan de Estudio : Educación Primaria . COD: ${data.cod}`, { bold: true })], AlignmentType.CENTER, 195),
  ];

  const anoEscolarLine = new Paragraph({
    children: [
      run("Año Escolar: ", { bold: true }),
      run(` ${data.yearRange} `, { bold: true, underline: true }),
      run("   Mes y Año de la Evaluación: ", { bold: true }),
      run(`        ${primariaMesAnioEvaluacion(data.yearRange)}        `, { bold: true, underline: true }),
    ],
    spacing: { before: 0, after: 0, line: 228, lineRule: "exact" as const },
  });

  const noMargins = { top: 0, bottom: 0, left: 0, right: 0 };
  return fixedTable(
    [
      new TableRow({
        children: [
          new TableCell({
            width: { size: HDR_COLS[0], type: WidthType.DXA },
            children: [buildLogoParagraph(logo)],
            borders: CELL_NONE,
            margins: { ...noMargins, left: 270 },
            verticalAlign: VerticalAlign.TOP,
          }),
          new TableCell({
            width: { size: HDR_COLS[1], type: WidthType.DXA },
            children: titleLines,
            borders: CELL_NONE,
            margins: noMargins,
            verticalAlign: VerticalAlign.TOP,
          }),
          new TableCell({
            width: { size: HDR_COLS[2], type: WidthType.DXA },
            children: [para([])],
            borders: CELL_NONE,
            margins: noMargins,
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: HDR_COLS[0], type: WidthType.DXA },
            children: [para([run("II. Datos de la Institución Educativa:", { bold: true })], AlignmentType.LEFT, 228)],
            borders: CELL_NONE,
            margins: noMargins,
            verticalAlign: VerticalAlign.BOTTOM,
          }),
          new TableCell({
            width: { size: HDR_COLS[1] + HDR_COLS[2], type: WidthType.DXA },
            columnSpan: 2,
            children: [anoEscolarLine],
            borders: CELL_NONE,
            margins: noMargins,
            verticalAlign: VerticalAlign.BOTTOM,
          }),
        ],
      }),
    ],
    HDR_COLS,
  );
}

// ── II. Datos de la institución (etiquetas + valores subrayados) ─────────────────────

type IeField = { label: string; value: string; labelW: number; lineW: number; first?: boolean };

function ieLabelCell(f: IeField): TableCell {
  return new TableCell({
    width: { size: f.labelW, type: WidthType.DXA },
    children: [para([run(f.label)], f.first ? AlignmentType.LEFT : AlignmentType.RIGHT, 230)],
    borders: CELL_NONE,
    margins: { top: 0, bottom: 0, left: 0, right: f.first ? 0 : 60 },
    verticalAlign: VerticalAlign.BOTTOM,
  });
}

function ieLineCell(f: IeField): TableCell {
  return new TableCell({
    width: { size: f.lineW, type: WidthType.DXA },
    children: [para([run(f.value)], AlignmentType.CENTER, 230)],
    borders: CELL_UNDERLINE,
    margins: { top: 0, bottom: 0, left: 20, right: 20 },
    verticalAlign: VerticalAlign.BOTTOM,
  });
}

function ieRow(fields: IeField[]): Table {
  const widths = fields.flatMap((f) => [f.labelW, f.lineW]);
  const last = fields.length * 2 - 1;
  widths[last] = CONTENT_W - widths.slice(0, last).reduce((a, b) => a + b, 0);
  const cells = fields.flatMap((f, i) => {
    const field = i === fields.length - 1 ? { ...f, lineW: widths[last] } : f;
    return [ieLabelCell(field), ieLineCell(field)];
  });
  return fixedTable([row(cells, 250)], widths);
}

function buildInstitucion(data: ResumenFinalPrimariaDocxData): Table[] {
  const h = data.schoolHeader;
  return [
    ieRow([
      { label: "Código de la Institución Educativa:", value: h.codigo_plantel ?? "", labelW: 3375, lineW: 1414, first: true },
      { label: "Denominación y Epónimo:", value: h.nombre_plantel ?? "", labelW: 2571, lineW: 0 },
    ]),
    ieRow([
      { label: "Dirección:", value: h.direccion_plantel ?? "", labelW: 932, lineW: 6268, first: true },
      { label: "Teléfono:", value: h.telefono_plantel ?? "", labelW: 1527, lineW: 0 },
    ]),
    ieRow([
      { label: "Municipio:", value: h.municipio_plantel ?? "", labelW: 932, lineW: 1928, first: true },
      { label: "Entidad Federal:", value: h.entidad_federal ?? "", labelW: 1768, lineW: 2250 },
      // CDCEE: dato de "Zona Educativa" en Planillas → Datos comunes.
      { label: "CDCEE:", value: h.zona_educativa ?? "", labelW: 1125, lineW: 0 },
    ]),
    ieRow([
      { label: "Director(a):", value: (h.director ?? "").toUpperCase(), labelW: 1100, lineW: 5778, first: true },
      { label: "Cédula de Identidad:", value: h.cedula_director ?? "", labelW: 2250, lineW: 0 },
    ]),
  ];
}

// ── III. Identificación del curso + IV. título y tabla de conversión ─────────────────

function buildCurso(data: ResumenFinalPrimariaDocxData): Paragraph[] {
  return [
    new Paragraph({
      children: [run("III. Identificación del Curso:", { bold: true })],
      spacing: { before: 140, after: 0, line: 230, lineRule: "exact" as const },
    }),
    new Paragraph({
      children: [
        run(`GRADO: ${primariaGradeOrdinal(data.sectionGradeLevel)}`, { bold: true }),
        run(`SECCIÓN: ${data.sectionName}`, { bold: true, tab: true }),
        run(`N° DE ESTUDIANTES DE LA SECCIÓN: ${data.totalStudentsInSection}`, { bold: true, tab: true }),
        run(`N° DE ESTUDIANTES EN ESTA PAG: ${data.studentsInPage}`, { bold: true, tab: true }),
      ],
      tabStops: [
        { type: TabStopType.LEFT, position: 2540 },
        { type: TabStopType.LEFT, position: 5030 },
        { type: TabStopType.LEFT, position: 9850 },
      ],
      spacing: { before: 110, after: 0, line: 230, lineRule: "exact" as const },
    }),
  ];
}

function buildResumenTitle(): Table {
  const leftW = 5160;
  const boxW = CONTENT_W - leftW;
  const conversion = new Paragraph({
    children: [
      run("Tabla de Conversión:", { bold: true }),
      ...["A (19-20)", "B (16-18)", "C (13-15)", "D (10-12)", "E (01-09)"].map((range) =>
        run(range, { bold: true, tab: true }),
      ),
    ],
    tabStops: [2362, 3540, 4718, 5896, 7074].map((position) => ({ type: TabStopType.LEFT, position })),
    spacing: { before: 0, after: 0, line: 230, lineRule: "exact" as const },
  });
  return fixedTable(
    [
      row(
        [
          new TableCell({
            width: { size: leftW, type: WidthType.DXA },
            children: [para([run("IV. Resumen Final de la Evaluación:", { bold: true })], AlignmentType.LEFT, 230)],
            borders: CELL_NONE,
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            verticalAlign: VerticalAlign.TOP,
          }),
          new TableCell({
            width: { size: boxW, type: WidthType.DXA },
            children: [conversion],
            borders: { top: LINE, bottom: LINE, left: LINE, right: LINE },
            margins: { top: 10, bottom: 10, left: 50, right: 20 },
            verticalAlign: VerticalAlign.CENTER,
          }),
        ],
        300,
      ),
    ],
    [leftW, boxW],
  );
}

// ── Tabla principal ────────────────────────────────────────────────────────────────

function padRows(students: PrimariaStudentRow[]): Array<PrimariaStudentRow | null> {
  const rows: Array<PrimariaStudentRow | null> = students.slice(0, PRIMARY_ROWS_PER_PART);
  while (rows.length < PRIMARY_ROWS_PER_PART) rows.push(null);
  return rows;
}

function evaluacionHeaderRows(): TableRow[] {
  const center = { bold: true, align: AlignmentType.CENTER } as const;
  return [
    row(
      [
        cell(C.NRO, "N°", { ...center, rowSpan: 2 }),
        cell(C.CED, ["Cédula de identidad o", "Cédula Escolar"], { ...center, rowSpan: 2 }),
        cell(C.LUG, "Lugar de Nacimiento", { ...center, span: 3, rowSpan: 2 }),
        cell(C.EF, "EF", { ...center, rowSpan: 2 }),
        cell(C.SEX, "Sexo", { ...center, rowSpan: 2 }),
        cell(C.DIA, "Fecha de nacimiento", { ...center, span: 5 }),
        cell(C.LIT, "Resultados de la Evaluación", { ...center, span: 5, size: SIZE_SMALL }),
        cell(C.P, "P.", { ...center, rowSpan: 2 }),
      ],
      ROW_HDR_H,
    ),
    row(
      [
        cell(C.DIA, "Día", { ...center, span: 2 }),
        cell(C.MES, "Mes", center),
        cell(C.ANO, "Año", { ...center, span: 2 }),
        ...PRIMARIA_LITERALS.map((l, i) => cell(C.LIT + i, l, center)),
      ],
      ROW_HDR_H,
    ),
  ];
}

function evaluacionDataRow(s: PrimariaStudentRow | null, nro: number): TableRow {
  const center = { align: AlignmentType.CENTER } as const;
  return row(
    [
      cell(C.NRO, pad2(String(nro))),
      cell(C.CED, s ? orEmpty(s.cedula) : EMPTY_TEXT),
      cell(C.LUG, s ? orEmpty(s.lugarNacimiento) : EMPTY_TEXT, { span: 3 }),
      cell(C.EF, s ? s.entidadFederal : EMPTY_SHORT, center),
      cell(C.SEX, s ? orEmpty(s.sexo, EMPTY_SHORT) : EMPTY_SHORT, center),
      cell(C.DIA, s ? orEmpty(pad2(s.diaNac), EMPTY_SHORT) : EMPTY_SHORT, { ...center, span: 2 }),
      cell(C.MES, s ? orEmpty(pad2(s.mesNac), EMPTY_SHORT) : EMPTY_SHORT, center),
      cell(C.ANO, s ? orEmpty(s.anioNac, EMPTY_SHORT) : EMPTY_SHORT, { ...center, span: 2 }),
      // Resultados: "*" por defecto; "X" en el literal de la definitiva final.
      ...PRIMARIA_LITERALS.map((l, i) => cell(C.LIT + i, s?.literal === l ? "X" : EMPTY_SHORT, center)),
      // P.: por ahora siempre "*".
      cell(C.P, EMPTY_SHORT, center),
    ],
    ROW_DATA_H,
  );
}

function totalRow(data: ResumenFinalPrimariaDocxData): TableRow {
  const bold = { bold: true, align: AlignmentType.CENTER } as const;
  return row(
    [
      cell(0, "TOTAL", { ...bold, span: C.LIT }),
      ...PRIMARIA_LITERALS.map((l, i) => cell(C.LIT + i, pad2(String(data.literalTotals[l])), bold)),
      cell(C.P, ""),
    ],
    ROW_TOTAL_H,
  );
}

const NAMES_APE = { start: 1, span: 3 };
const NAMES_NOM = { start: 4, span: 14 };

function nombresHeaderRow(): TableRow {
  const center = { bold: true, align: AlignmentType.CENTER } as const;
  return row(
    [
      cell(C.NRO, "N°", center),
      cell(NAMES_APE.start, "Apellidos", { ...center, span: NAMES_APE.span }),
      cell(NAMES_NOM.start, "Nombres", { ...center, span: NAMES_NOM.span }),
    ],
    ROW_HDR_H,
  );
}

function nombresDataRow(s: PrimariaStudentRow | null, nro: number): TableRow {
  return row(
    [
      cell(C.NRO, pad2(String(nro))),
      cell(NAMES_APE.start, s ? orEmpty(s.apellidos) : EMPTY_TEXT, { span: NAMES_APE.span }),
      cell(NAMES_NOM.start, s ? orEmpty(s.nombres) : EMPTY_TEXT, { span: NAMES_NOM.span }),
    ],
    ROW_DATA_H,
  );
}

function docenteRow(data: ResumenFinalPrimariaDocxData): TableRow {
  const top = { valign: VerticalAlign.TOP } as const;
  return row(
    [
      cell(0, ["Apellidos y Nombres del(la) Docente:", data.nombreProfesor.toUpperCase()], { ...top, span: 4 }),
      cell(4, ["Número de C.I:", data.cedulaProfesor], { ...top, span: 4 }),
      cell(8, "Firma", { span: 10 }),
    ],
    ROW_DOCENTE_H,
  );
}

function observacionesRow(data: ResumenFinalPrimariaDocxData): TableRow {
  const obs = data.observaciones.trim();
  return row(
    [
      new TableCell({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnSpan: GRID.length,
        children: [
          para([run("V. Observaciones:", { bold: true, size: SIZE_SMALL })], AlignmentType.LEFT, 230),
          ...(obs ? obs.split(/\r?\n/).map((l) => para([run(l)], AlignmentType.LEFT, 230)) : []),
        ],
        verticalAlign: VerticalAlign.TOP,
        margins: { top: 0, bottom: 0, left: 40, right: 20 },
      }),
    ],
    ROW_HDR_H,
  );
}

const SIG_DIR = { start: 0, span: 3 };
const SIG_SELLO_IE = { start: 3, span: 1 };
const SIG_FUNC = { start: 4, span: 7 };
const SIG_SELLO_CDCEE = { start: 11, span: 7 };

function firmasRows(data: ResumenFinalPrimariaDocxData): TableRow[] {
  const h = data.schoolHeader;
  const bold = { bold: true } as const;
  const boldCenter = { bold: true, align: AlignmentType.CENTER } as const;
  const dir = (cellText: string, opts: CellOpts = bold) => cell(SIG_DIR.start, cellText, { ...opts, span: SIG_DIR.span });
  const func = (cellText: string, opts: CellOpts = bold) => cell(SIG_FUNC.start, cellText, { ...opts, span: SIG_FUNC.span });
  const sigRow = (cells: TableCell[]) => row(cells, ROW_DATA_H);

  return [
    sigRow([
      cell(0, `VI. Fecha de Remisión:  ${primariaFechaRemision(data.yearRange)}`, { ...bold, span: 4 }),
      cell(4, "VII. Fecha de Recepción:", { ...bold, span: 14 }),
    ]),
    sigRow([
      dir("Director(a)", boldCenter),
      cell(SIG_SELLO_IE.start, ["SELLO DE LA INSTITUCIÓN", "EDUCATIVA"], { ...boldCenter, rowSpan: 6 }),
      func("Funcionario(a) Receptor(a)", boldCenter),
      cell(
        SIG_SELLO_CDCEE.start,
        ["SELLO DEL CENTRO DE", "DESARROLLO DE LA CALIDAD", "EDUCATIVA ESTADAL"],
        { ...boldCenter, span: SIG_SELLO_CDCEE.span, rowSpan: 6 },
      ),
    ]),
    sigRow([dir("Apellidos y Nombres:"), func("Apellidos y Nombres:")]),
    sigRow([dir((h.director ?? "").toUpperCase(), boldCenter), func("")]),
    sigRow([dir("Cédula de Identidad"), func("Cédula de Identidad")]),
    sigRow([dir(h.cedula_director ?? "", boldCenter), func("")]),
    sigRow([dir("Firma:"), func("Firma:")]),
  ];
}

function buildMainTable(data: ResumenFinalPrimariaDocxData): Table {
  const rows = padRows(data.students);
  return fixedTable(
    [
      ...evaluacionHeaderRows(),
      ...rows.map((s, i) => evaluacionDataRow(s, i + 1)),
      totalRow(data),
      nombresHeaderRow(),
      ...rows.map((s, i) => nombresDataRow(s, i + 1)),
      docenteRow(data),
      observacionesRow(data),
      ...firmasRows(data),
    ],
    GRID,
    BORDERS_GRID,
  );
}

function gap(before: number): Paragraph {
  return new Paragraph({
    children: [run("", { size: 1 })],
    spacing: { before, after: 0, line: 20, lineRule: "exact" as const },
  });
}

async function loadLogo(): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(logoMppeNuevo);
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

/** Genera un .docx con una hoja por sección/parte de primaria (máx. 20 estudiantes por hoja). */
export async function generateResumenFinalPrimariaDocx(
  sections: ResumenFinalPrimariaDocxData | ResumenFinalPrimariaDocxData[],
): Promise<Blob> {
  const list = Array.isArray(sections) ? sections : [sections];
  const logo = await loadLogo();

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT, size: SIZE * 2 },
          paragraph: { spacing: { before: 0, after: 0 } },
        },
      },
    },
    sections: list.map((data, index) => ({
      properties: {
        ...(index > 0 ? { type: SectionType.NEXT_PAGE } : {}),
        page: {
          size: { width: PAGE_W, height: PAGE_H },
          margin: { top: MARGIN_TOP, bottom: MARGIN_BOTTOM, left: MARGIN_LEFT, right: MARGIN_RIGHT },
        },
      },
      children: [
        buildHeader(data, logo),
        gap(40),
        ...buildInstitucion(data),
        ...buildCurso(data),
        gap(60),
        buildResumenTitle(),
        gap(60),
        buildMainTable(data),
      ],
    })),
  });

  return Packer.toBlob(doc);
}
