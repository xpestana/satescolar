import {
  AlignmentType,
  BorderStyle,
  Document,
  HeightRule,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextDirection,
  TextRun,
  UnderlineType,
  VerticalAlign,
  WidthType,
} from "docx";
import logoMppeNuevo from "@/assets/logo-mppe-nuevo.jpg";
import type { CertificatePrintModel, PrintGradeRow, PrintInstitution, PrintYear } from "@/lib/grade-certificate-print";
import { detectImageType, getImageDimensions } from "@/lib/resumen-final-docx-base";
import { isPlanillaPlaceholder } from "@/lib/resumen-final-text";

// ── Certificación de Calificaciones EMG. Medidas tomadas del formato de referencia (.docx) ──
const PAGE_W = 13890; // 24.5 cm
const PAGE_H = 20700; // 36.5 cm
const MARGIN_TOP = 540;
const MARGIN_BOTTOM = 280;
const MARGIN_LEFT = 560;
const CONTENT_W = 12800;
const MARGIN_RIGHT = PAGE_W - MARGIN_LEFT - CONTENT_W;

const FONT = "Arial";
const SIZE_LABEL = 10; // títulos de sección, etiquetas y valores de la cabecera
const SIZE_HEAD = 8; // encabezados de tabla
const SIZE_CELL = 7; // contenido de las tablas
const SIZE_NOTE = 6.5;

/** Rejilla de la tabla de un año: área, N°, letras, T-E, mes, año, institución. */
const YEAR_GRID = [3118, 283, 1133, 283, 453, 453, 566];
const YEAR_W = YEAR_GRID.reduce((a, b) => a + b, 0);
const YEAR_GAP = CONTENT_W - YEAR_W * 2;

/** Rejilla de las tablas de instituciones: N°, denominación, localidad, E.F. */
const INSTITUTION_GRID = [454, 3402, 1361, 567];
const INSTITUTION_W = INSTITUTION_GRID.reduce((a, b) => a + b, 0);
const INSTITUTION_GAP = CONTENT_W - INSTITUTION_W * 2;
/** Instituciones de la tabla izquierda; el resto va en la derecha. */
const INSTITUTIONS_LEFT = 2;

/** Rejilla de Orientación y Convivencia + grupos: área, año, grupo, literal. */
const EXTRAS_GRID = [2560, 670, 2323, YEAR_W - 2560 - 670 - 2323];

/** Rejilla de las firmas: director, sello, director CDCEE, sello CDCEE. */
const SIGNATURE_GRID = [3118, 3368, 3090, CONTENT_W - 3118 - 3368 - 3090];

const ROW_TITLE_H = 226;
const ROW_HEAD_H = 211;
const ROW_DATA_H = 373;
const ROW_DATA_MIN_H = 236;
const ROW_LINE_H = 283;
/**
 * Filas de áreas (suma de las tres franjas) que caben a la altura normal en una hoja. En realidad
 * caben 23; se deja una de holgura para los nombres de área que ocupan dos líneas.
 */
const DATA_ROWS_FULL_HEIGHT = 22;

const LOGO_W_PX = 375;
const LOGO_MAX_H_PX = 66;

type Align = (typeof AlignmentType)[keyof typeof AlignmentType];
type VAlign = (typeof VerticalAlign)[keyof typeof VerticalAlign];

const LINE = { style: BorderStyle.SINGLE, size: 6, color: "000000" } as const;
const NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } as const;
const BORDERS_GRID = { top: LINE, bottom: LINE, left: LINE, right: LINE, insideHorizontal: LINE, insideVertical: LINE };
const BORDERS_NONE = { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE };
const CELL_NONE = { top: NONE, bottom: NONE, left: NONE, right: NONE };
const CELL_UNDERLINE = { top: NONE, left: NONE, right: NONE, bottom: LINE };
const NO_MARGINS = { top: 0, bottom: 0, left: 0, right: 0 };

type RunOpts = { bold?: boolean; size?: number; underline?: boolean };

function run(text: string, opts: RunOpts = {}): TextRun {
  return new TextRun({
    text,
    font: FONT,
    size: (opts.size ?? SIZE_LABEL) * 2,
    bold: opts.bold ?? false,
    underline: opts.underline ? { type: UnderlineType.SINGLE } : undefined,
  });
}

function para(children: TextRun[], align: Align = AlignmentType.LEFT, before = 0): Paragraph {
  return new Paragraph({ children, alignment: align, spacing: { before, after: 0 } });
}

/** Párrafo casi sin alto: separa dos tablas para que Word no las una. */
function gap(before = 0): Paragraph {
  return new Paragraph({
    children: [run("", { size: 1 })],
    spacing: { before, after: 0, line: 20, lineRule: "exact" as const },
  });
}

function fixedTable(rows: TableRow[], widths: number[], borders: typeof BORDERS_NONE | typeof BORDERS_GRID): Table {
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders,
    rows,
  });
}

function row(cells: TableCell[], height: number): TableRow {
  return new TableRow({ children: cells, height: { value: height, rule: HeightRule.ATLEAST } });
}

type CellOpts = {
  span?: number;
  rowSpan?: number;
  bold?: boolean;
  size?: number;
  align?: Align;
  valign?: VAlign;
  vertical?: boolean;
  /** Sin márgenes laterales: para textos justos en columnas angostas (T-E, LITERAL). */
  tight?: boolean;
};

/** Celda con bordes de una tabla de rejilla `grid`; los rellenos de asteriscos van centrados. */
function gridCell(grid: number[], start: number, text: string | string[], opts: CellOpts = {}): TableCell {
  const span = opts.span ?? 1;
  const lines = Array.isArray(text) ? text : [text];
  return new TableCell({
    width: { size: grid.slice(start, start + span).reduce((a, b) => a + b, 0), type: WidthType.DXA },
    ...(span > 1 ? { columnSpan: span } : {}),
    ...(opts.rowSpan ? { rowSpan: opts.rowSpan } : {}),
    ...(opts.vertical ? { textDirection: TextDirection.BOTTOM_TO_TOP_LEFT_TO_RIGHT } : {}),
    children: lines.map((line) =>
      para(
        [run(line, { bold: opts.bold ?? true, size: opts.size ?? SIZE_CELL })],
        isPlanillaPlaceholder(line) ? AlignmentType.CENTER : (opts.align ?? AlignmentType.CENTER),
      )),
    verticalAlign: opts.valign ?? VerticalAlign.CENTER,
    margins: { top: 0, bottom: 0, left: opts.tight ? 0 : 50, right: opts.tight ? 0 : 30 },
  });
}

/** Celda sin bordes que contiene otra tabla (Word exige un párrafo al final de la celda). */
function holderCell(width: number, children: Array<Paragraph | Table>): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    children: [...children, gap()],
    borders: CELL_NONE,
    margins: NO_MARGINS,
    verticalAlign: VerticalAlign.TOP,
  });
}

/** Dos bloques lado a lado, separados por un espacio. */
function sideBySide(
  left: Array<Paragraph | Table>,
  right: Array<Paragraph | Table>,
  blockWidth: number,
  gapWidth: number,
): Table {
  return fixedTable(
    [new TableRow({ children: [holderCell(blockWidth, left), holderCell(gapWidth, []), holderCell(blockWidth, right)] })],
    [blockWidth, gapWidth, blockWidth],
    BORDERS_NONE,
  );
}

// ── Cabecera: logo + título, plan de estudio y expedición ────────────────────────────

const HEADER_COLS = [5900, CONTENT_W - 5900];

function logoParagraph(logo: ArrayBuffer | null): Paragraph {
  if (!logo) return para([run("MINISTERIO DEL PODER POPULAR PARA LA EDUCACIÓN", { bold: true, size: SIZE_HEAD })]);
  const dims = getImageDimensions(logo);
  let width = LOGO_W_PX;
  let height = dims ? Math.round(LOGO_W_PX * (dims.height / dims.width)) : LOGO_MAX_H_PX;
  if (height > LOGO_MAX_H_PX) {
    width = Math.round(width * (LOGO_MAX_H_PX / height));
    height = LOGO_MAX_H_PX;
  }
  return new Paragraph({
    children: [new ImageRun({ type: detectImageType(logo), data: logo, transformation: { width, height } })],
    spacing: { before: 0, after: 0 },
  });
}

function buildHeader(model: CertificatePrintModel, logo: ArrayBuffer | null): Table {
  const underlined = (text: string) => run(`  ${text}  `, { underline: true });
  return fixedTable(
    [
      new TableRow({
        children: [
          new TableCell({
            width: { size: HEADER_COLS[0], type: WidthType.DXA },
            children: [logoParagraph(logo)],
            borders: CELL_NONE,
            margins: NO_MARGINS,
            verticalAlign: VerticalAlign.CENTER,
          }),
          new TableCell({
            width: { size: HEADER_COLS[1], type: WidthType.DXA },
            children: [
              para([run(model.title, { bold: true, underline: true })], AlignmentType.CENTER),
              para([
                run("I. Plan de estudio:", { bold: true }),
                underlined(model.planName),
                run("   Código: ", { bold: true }),
                underlined(`  ${model.planCode}  `),
              ], AlignmentType.LEFT, 90),
              para([run("Lugar y Fecha de Expedición: ", { bold: true }), underlined(model.issueLine)], AlignmentType.LEFT, 90),
            ],
            borders: CELL_NONE,
            margins: NO_MARGINS,
            verticalAlign: VerticalAlign.CENTER,
          }),
        ],
      }),
    ],
    HEADER_COLS,
    BORDERS_NONE,
  );
}

// ── II y III: etiquetas en negrita con su valor sobre una línea ───────────────────────

/** `lineW: 0` = el valor ocupa lo que quede de la fila; sin `value` = solo la etiqueta. */
type Field = { label: string; value?: string; labelW: number; lineW?: number };

function fieldRow(fields: Field[]): Table {
  const widths = fields.flatMap((f) => (f.value === undefined ? [f.labelW] : [f.labelW, f.lineW ?? 0]));
  const used = widths.reduce((a, b) => a + b, 0);
  widths[widths.length - 1] += CONTENT_W - used;

  let column = 0;
  const cells = fields.flatMap((f, index) => {
    const label = new TableCell({
      width: { size: widths[column++], type: WidthType.DXA },
      children: [para([run(f.label, { bold: true })], index === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT)],
      borders: CELL_NONE,
      margins: { ...NO_MARGINS, right: index === 0 ? 0 : 60 },
      verticalAlign: VerticalAlign.BOTTOM,
    });
    if (f.value === undefined) return [label];
    const line = new TableCell({
      width: { size: widths[column++], type: WidthType.DXA },
      children: [para([run(f.value)], AlignmentType.CENTER)],
      borders: CELL_UNDERLINE,
      margins: { ...NO_MARGINS, left: 20, right: 20 },
      verticalAlign: VerticalAlign.BOTTOM,
    });
    return [label, line];
  });
  return fixedTable([row(cells, 284)], widths, BORDERS_NONE);
}

function sectionTitle(text: string, before = 80): Paragraph {
  return para([run(text, { bold: true })], AlignmentType.LEFT, before);
}

function buildSchool(model: CertificatePrintModel): Array<Paragraph | Table> {
  const s = model.school;
  return [
    sectionTitle(
      "II. Datos de la institución Educativa o Centro de Desarrollo de la Calidad Educativa Estatal (CDCEE) que Emite la Certificación:",
      120,
    ),
    gap(60),
    fieldRow([
      { label: "Código:", value: s.code, labelW: 820, lineW: 1500 },
      { label: "Denominación y Epónimo:", value: s.name, labelW: 3150, lineW: 0 },
    ]),
    fieldRow([
      { label: "Dirección:", value: s.address, labelW: 1080, lineW: 7950 },
      { label: "Teléfono:", value: s.phone, labelW: 1800, lineW: 0 },
    ]),
    fieldRow([
      { label: "Municipio:", value: s.municipality, labelW: 1080, lineW: 1750 },
      { label: "Entidad Federal:", value: s.federalEntity, labelW: 3300, lineW: 1400 },
      { label: "CDCEE:", value: s.cdcee, labelW: 3300, lineW: 0 },
    ]),
  ];
}

function buildStudent(model: CertificatePrintModel): Array<Paragraph | Table> {
  const s = model.student;
  return [
    sectionTitle("III. Datos de Identificación del Estudiante:"),
    fieldRow([
      { label: "Cédula de Identidad:", value: s.documentId, labelW: 2200, lineW: 1600 },
      { label: "Fecha de Nacimiento:", value: s.birthDate, labelW: 3850, lineW: 0 },
    ]),
    fieldRow([
      { label: "Apellidos:", value: s.lastNames, labelW: 1080, lineW: 5130 },
      { label: "Nombres:", value: s.firstNames, labelW: 1250, lineW: 0 },
    ]),
    fieldRow([
      { label: "Lugar de Nacimiento:", labelW: 2150 },
      { label: "País:", value: s.birthCountry, labelW: 820, lineW: 1400 },
      { label: "Estado:", value: s.birthState, labelW: 1000, lineW: 1250 },
      { label: "Municipio:", value: s.birthMunicipality, labelW: 1300, lineW: 0 },
    ]),
  ];
}

// ── IV. Instituciones donde cursó estudios (dos tablas lado a lado) ───────────────────

function institutionsTable(institutions: PrintInstitution[]): Table {
  const cell = (start: number, text: string | string[], opts: CellOpts = {}) => gridCell(INSTITUTION_GRID, start, text, opts);
  return fixedTable(
    [
      row([
        cell(0, "N°", { size: SIZE_HEAD }),
        cell(1, ["Denominación y Epónimo de la", "Institución Educativa"], { size: SIZE_HEAD }),
        cell(2, "Localidad", { size: SIZE_HEAD }),
        cell(3, "E.F", { size: SIZE_HEAD }),
      ], 400),
      ...institutions.map((institution) =>
        row([
          cell(0, String(institution.number), { bold: false }),
          cell(1, institution.name, { bold: false }),
          cell(2, institution.locality, { bold: false }),
          cell(3, institution.federalEntity, { bold: false }),
        ], ROW_LINE_H)),
    ],
    INSTITUTION_GRID,
    BORDERS_GRID,
  );
}

function buildInstitutions(model: CertificatePrintModel): Table {
  return sideBySide(
    [
      sectionTitle("IV. Instituciones Educativas donde Curso Estudios:", 100),
      gap(100),
      institutionsTable(model.institutions.slice(0, INSTITUTIONS_LEFT)),
    ],
    [institutionsTable(model.institutions.slice(INSTITUTIONS_LEFT))],
    INSTITUTION_W,
    INSTITUTION_GAP,
  );
}

// ── V. Plan de estudio: una tabla por año ────────────────────────────────────────────

function yearTable(year: PrintYear, dataRowHeight: number): Table {
  const cell = (start: number, text: string, opts: CellOpts = {}) => gridCell(YEAR_GRID, start, text, opts);
  const head = { size: SIZE_HEAD } as const;
  const dataRow = (r: PrintGradeRow) =>
    row([
      cell(0, r.subjectName, { align: AlignmentType.LEFT }),
      cell(1, r.grade),
      cell(2, r.gradeInWords),
      cell(3, r.evaluationType),
      cell(4, r.month),
      cell(5, r.year),
      cell(6, r.institution),
    ], dataRowHeight);

  return fixedTable(
    [
      row([cell(0, year.title, { ...head, span: YEAR_GRID.length })], ROW_TITLE_H),
      row([
        cell(0, "ÁREAS DE FORMACIÓN:", { ...head, rowSpan: 2 }),
        cell(1, "CALIFICACIÓN:", { ...head, span: 2 }),
        cell(3, "T-E", { rowSpan: 2, tight: true }),
        cell(4, "Fecha", { ...head, span: 2 }),
        cell(6, "Inst. Educ.", { size: 5, rowSpan: 2, vertical: true }),
      ], ROW_HEAD_H),
      row([cell(1, "N°", head), cell(2, "LETRAS", head), cell(4, "Mes", head), cell(5, "Año", head)], ROW_HEAD_H),
      ...year.rows.map(dataRow),
    ],
    YEAR_GRID,
    BORDERS_GRID,
  );
}

/** Orientación y Convivencia (literal por año) y Participación en Grupos (grupo + literal). */
function extrasTable(model: CertificatePrintModel, totalHeight: number): Table {
  const cell = (start: number, text: string | string[], opts: CellOpts = {}) => gridCell(EXTRAS_GRID, start, text, opts);
  const head = { size: SIZE_HEAD } as const;
  const dataRows = model.orientation.length + model.groups.length;
  const height = Math.max(ROW_TITLE_H, Math.floor((totalHeight - ROW_TITLE_H * 2) / dataRows));

  return fixedTable(
    [
      row([cell(0, "ÁREAS DE FORMACIÓN", head), cell(1, "AÑO", head), cell(2, "LITERAL", { ...head, span: 2 })], ROW_TITLE_H),
      ...model.orientation.map((o, index) =>
        row([
          ...(index === 0 ? [cell(0, "ORIENTACIÓN Y CONVIVENCIA", { ...head, rowSpan: model.orientation.length })] : []),
          cell(1, o.yearLabel, head),
          cell(2, o.literal, { ...head, span: 2 }),
        ], height)),
      row([
        cell(0, "ÁREAS DE FORMACIÓN", head),
        cell(1, "AÑO", head),
        cell(2, "GRUPO", head),
        cell(3, "LITERAL", { tight: true }),
      ], ROW_TITLE_H),
      ...model.groups.map((g, index) =>
        row([
          ...(index === 0
            ? [cell(0, ["PARTICIPACIÓN EN GRUPOS DE", "CREACIÓN, RECREACIÓN Y", "PRODUCCIÓN"], { rowSpan: model.groups.length })]
            : []),
          cell(1, g.yearLabel, head),
          cell(2, g.groupName, head),
          cell(3, g.literal, head),
        ], height)),
    ],
    EXTRAS_GRID,
    BORDERS_GRID,
  );
}

/**
 * Alto de las filas de áreas. Con más áreas de las que trae el formato se achican para que la
 * certificación siga cabiendo en una hoja; con muchas más, Word pasa a una segunda hoja.
 */
export function certificateDataRowHeight(years: PrintYear[]): number {
  const rowsOf = (index: number) => years[index]?.rows.length ?? 0;
  const total = Math.max(rowsOf(0), rowsOf(1)) + Math.max(rowsOf(2), rowsOf(3)) + rowsOf(4);
  if (total <= DATA_ROWS_FULL_HEIGHT) return ROW_DATA_H;
  return Math.max(ROW_DATA_MIN_H, Math.floor((ROW_DATA_H * DATA_ROWS_FULL_HEIGHT) / total));
}

function buildStudyPlan(model: CertificatePrintModel): Array<Paragraph | Table> {
  const rowHeight = certificateDataRowHeight(model.years);
  const [first, second, third, fourth, fifth] = model.years.map((year) => yearTable(year, rowHeight));
  const fifthHeight = ROW_TITLE_H + ROW_HEAD_H * 2 + model.years[4].rows.length * rowHeight;
  const blockTitle = (text: string) => para([run(text, { bold: true, size: SIZE_HEAD })], AlignmentType.CENTER);

  return [
    sectionTitle("V. Plan de Estudio:", 40),
    sideBySide([first], [second], YEAR_W, YEAR_GAP),
    gap(120),
    sideBySide([third], [fourth], YEAR_W, YEAR_GAP),
    gap(60),
    sideBySide(
      [blockTitle(""), fifth],
      [blockTitle("ÁREAS DE FORMACIÓN"), extrasTable(model, fifthHeight)],
      YEAR_W,
      YEAR_GAP,
    ),
  ];
}

// ── VI. Observaciones + VII / VIII firmas ────────────────────────────────────────────

function buildClosing(model: CertificatePrintModel): Table {
  const cell = (start: number, text: string | string[], opts: CellOpts = {}) => gridCell(SIGNATURE_GRID, start, text, opts);
  const left: CellOpts = { align: AlignmentType.LEFT };
  const center: CellOpts = {};
  const full = { span: SIGNATURE_GRID.length } as const;
  const observationLines = [...model.observations];
  while (observationLines.length < 2) observationLines.push("");

  const signatureRow = (school: string, cdcee: string, opts: CellOpts) =>
    row([cell(0, school, opts), cell(2, cdcee, opts)], ROW_TITLE_H);

  return fixedTable(
    [
      row([cell(0, "VI. Observaciones:", { ...left, ...full })], ROW_TITLE_H),
      ...observationLines.map((line) => row([cell(0, line, { ...left, ...full, bold: false })], ROW_LINE_H)),
      row([
        cell(0, "VII. Institución Educativa", { ...left, span: 2 }),
        cell(2, "VIII. Centro de Desarrollo de la Calidad Educativa Estadal", { ...left, span: 2 }),
      ], ROW_TITLE_H),
      row([
        cell(0, "Director(a):", center),
        cell(1, "SELLO DE LA INSTITUCIÓN EDUCATIVA", { ...center, rowSpan: 7 }),
        cell(2, "Director(a):", center),
        cell(3, ["SELLO DEL CENTRO DE DESARROLLO DE", "LA CALIDAD EDUCATIVA ESTADAL"], { ...center, rowSpan: 7 }),
      ], ROW_TITLE_H),
      signatureRow("Apellidos y Nombres:", "Apellidos y Nombres:", left),
      signatureRow(model.director.name, model.cdceeDirector.name, center),
      signatureRow("Cédula de Identidad:", "Cédula de Identidad:", left),
      signatureRow(model.director.documentId, model.cdceeDirector.documentId, center),
      signatureRow("Firma:", "Firma:", left),
      signatureRow("Para efectos de su Validez Nacional", "Para efectos de su Validez Internacional", left),
    ],
    SIGNATURE_GRID,
    BORDERS_GRID,
  );
}

const FISCAL_NOTE =
  "VALOR FISCAL: Para su validez legal y de acuerdo al Ramo de Estampillas, al dorso de este documento se le debe "
  + "colocar tres decimas de la Unidad Tributaria (0,3 U.T.)";

/** Arma el documento; `logo` es la imagen de cabecera (sin ella se escribe el nombre del ministerio). */
export function buildGradeCertificateDocument(model: CertificatePrintModel, logo: ArrayBuffer | null): Document {
  return new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT, size: SIZE_LABEL * 2 },
          paragraph: { spacing: { before: 0, after: 0 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_W, height: PAGE_H },
            margin: { top: MARGIN_TOP, bottom: MARGIN_BOTTOM, left: MARGIN_LEFT, right: MARGIN_RIGHT },
          },
        },
        children: [
          buildHeader(model, logo),
          ...buildSchool(model),
          ...buildStudent(model),
          gap(60),
          buildInstitutions(model),
          ...buildStudyPlan(model),
          gap(),
          buildClosing(model),
          para([run(FISCAL_NOTE, { bold: true, size: SIZE_NOTE })], AlignmentType.LEFT, 30),
        ],
      },
    ],
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

/** Genera el .docx de la Certificación de Notas de un estudiante. */
export async function generateGradeCertificateDocx(model: CertificatePrintModel): Promise<Blob> {
  return Packer.toBlob(buildGradeCertificateDocument(model, await loadLogo()));
}
