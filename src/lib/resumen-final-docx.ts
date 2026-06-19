import {
  AlignmentType,
  BorderStyle,
  Document,
  HeightRule,
  ImageRun,
  PageBreak,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  VerticalMergeType,
  WidthType,
} from "docx";
import type { ResumenFinalDocxData, SubjectCol } from "@/hooks/useResumenFinalDocxData";

// ─── page dimensions ────────────────────────────────────────────────
const PAGE_W = 12240; // twips (216 mm)
const PAGE_H = 20145; // twips (356 mm)
const MARGIN = 360;   // twips ≈ 6.35 mm
const CONTENT_W = PAGE_W - MARGIN * 2; // 11520 twips

// ─── left section col widths (sum = 6720 twips ≈ 118.5 mm) ─────────
const W_NRO = 300;
const W_CED = 1080;
const W_APE = 1350;
const W_NOM = 1350;
const W_LUG = 1020;
const W_EF  = 300;
const W_SEX = 300;
const W_DIA = 300;
const W_MES = 300;
const W_ANO = 420;
const LEFT_TOTAL = W_NRO + W_CED + W_APE + W_NOM + W_LUG + W_EF + W_SEX + W_DIA + W_MES + W_ANO; // 6720
const RIGHT_TOTAL = CONTENT_W - LEFT_TOTAL; // 4800

const LOGO_URL = "https://satescolar.s3.us-east-1.amazonaws.com/planillas/LOGO+NUEVO+MPPE+(2).jpg";

// ─── border helpers ──────────────────────────────────────────────────
const BS = { style: BorderStyle.SINGLE, size: 4, color: "000000" } as const;
const BN = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } as const;
const BORDERS_ALL = { top: BS, bottom: BS, left: BS, right: BS, insideHorizontal: BS, insideVertical: BS };
const BORDERS_NONE = { top: BN, bottom: BN, left: BN, right: BN, insideHorizontal: BN, insideVertical: BN };
const BORDERS_OUTER = { top: BS, bottom: BS, left: BS, right: BS, insideHorizontal: BN, insideVertical: BN };

// ─── text / paragraph helpers ────────────────────────────────────────
type TxtOpts = { bold?: boolean; size?: number; italics?: boolean };

function t(text: string, opts?: TxtOpts): TextRun {
  return new TextRun({
    text: text ?? "",
    font: "Times New Roman",
    size: (opts?.size ?? 10) * 2,
    bold: opts?.bold ?? false,
    italics: opts?.italics ?? false,
  });
}

function p(children: TextRun | TextRun[], align?: AlignmentType): Paragraph {
  return new Paragraph({
    children: Array.isArray(children) ? children : [children],
    alignment: align ?? AlignmentType.LEFT,
    spacing: { before: 0, after: 0, line: 200, lineRule: "auto" as any },
  });
}

const emptyP = () => p(t(""));

// ─── cell builder ────────────────────────────────────────────────────
interface CellOpts {
  w?: number;
  span?: number;
  vMerge?: "restart" | "continue";
  vAlign?: "top" | "center" | "bottom";
  align?: AlignmentType;
  bold?: boolean;
  shade?: string;
  borders?: "all" | "none" | "outer";
  mt?: number; mb?: number; ml?: number; mr?: number;
  size?: number;
}

function mkCell(text: string, opts: CellOpts = {}): TableCell {
  const borders =
    opts.borders === "none" ? BORDERS_NONE :
    opts.borders === "outer" ? BORDERS_OUTER :
    BORDERS_ALL;

  const vAlign =
    opts.vAlign === "center" ? VerticalAlign.CENTER :
    opts.vAlign === "bottom" ? VerticalAlign.BOTTOM :
    VerticalAlign.CENTER;

  const vMerge =
    opts.vMerge === "restart" ? VerticalMergeType.RESTART :
    opts.vMerge === "continue" ? VerticalMergeType.CONTINUE :
    undefined;

  return new TableCell({
    columnSpan: opts.span,
    verticalMerge: vMerge,
    width: opts.w != null ? { size: opts.w, type: WidthType.DXA } : undefined,
    children: [p(t(text, { bold: opts.bold, size: opts.size }), opts.align)],
    borders,
    verticalAlign: vAlign,
    shading: opts.shade ? { fill: opts.shade, type: ShadingType.CLEAR, color: opts.shade } : undefined,
    margins: {
      top: opts.mt ?? 30,
      bottom: opts.mb ?? 30,
      left: opts.ml ?? 50,
      right: opts.mr ?? 50,
    },
  });
}

function mkCellPara(paras: Paragraph[], opts: CellOpts = {}): TableCell {
  const borders =
    opts.borders === "none" ? BORDERS_NONE :
    opts.borders === "outer" ? BORDERS_OUTER :
    BORDERS_ALL;
  return new TableCell({
    columnSpan: opts.span,
    width: opts.w != null ? { size: opts.w, type: WidthType.DXA } : undefined,
    children: paras,
    borders,
    verticalAlign: opts.vAlign === "center" ? VerticalAlign.CENTER : VerticalAlign.TOP,
    shading: opts.shade ? { fill: opts.shade, type: ShadingType.CLEAR, color: opts.shade } : undefined,
    margins: { top: opts.mt ?? 30, bottom: opts.mb ?? 30, left: opts.ml ?? 50, right: opts.mr ?? 50 },
  });
}

function mkRow(cells: TableCell[], heightTwips?: number): TableRow {
  return new TableRow({
    children: cells,
    height: heightTwips ? { value: heightTwips, rule: HeightRule.AT_LEAST } : undefined,
  });
}

function table(rows: TableRow[], w = CONTENT_W): Table {
  return new Table({
    width: { size: w, type: WidthType.DXA },
    rows,
    borders: BORDERS_ALL,
  });
}

// ─── grade label mapping ──────────────────────────────────────────────
const GRADE_PLAN_LABEL: Record<string, string> = {
  "1_ano": "1ER AÑO", "2_ano": "2DO AÑO", "3_ano": "3ER AÑO",
  "4_ano": "4TO AÑO", "5_ano": "5TO AÑO", "6_ano": "6TO AÑO",
  "1_grado": "1ER GRADO", "2_grado": "2DO GRADO", "3_grado": "3ER GRADO",
  "4_grado": "4TO GRADO", "5_grado": "5TO GRADO", "6_grado": "6TO GRADO",
  "pre_maternal": "PRE-MATERNAL", "maternal": "MATERNAL",
  "i_nivel": "I NIVEL", "ii_nivel": "II NIVEL", "iii_nivel": "III NIVEL",
};

// ─── per-subject statistics ───────────────────────────────────────────
interface SubjectStats {
  inscritos: number;
  inasistentes: number;
  aprobados: number;
  noAprobados: number;
}

function computeSubjectStats(subj: SubjectCol, data: ResumenFinalDocxData): SubjectStats {
  const PASS = 10;
  let inscritos = 0, aprobados = 0, noAprobados = 0;
  data.students.forEach(row => {
    const g = row.grades[subj.assignmentId] ?? "";
    if (!g) return;
    inscritos++;
    const n = parseFloat(g);
    if (isNaN(n)) { aprobados++; return; } // literal → approved
    if (n >= PASS) aprobados++; else noAprobados++;
  });
  return { inscritos, inasistentes: data.students.length - inscritos, aprobados, noAprobados };
}

// ──────────────────────────────────────────────────────────────────────
// BLOCK BUILDERS
// ──────────────────────────────────────────────────────────────────────

async function buildHeaderBlock(data: ResumenFinalDocxData, logoBuffer: ArrayBuffer | null): Promise<Table> {
  const h = data.schoolHeader;
  const tipoPlanilla = data.tipoPlanilla;
  const logoCell = mkCellPara(
    logoBuffer
      ? [new Paragraph({
          children: [new ImageRun({ type: "jpg", data: logoBuffer, transformation: { width: 130, height: 82 } })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 0 },
        })]
      : [p(t("GOBIERNO BOLIVARIANO\nDE VENEZUELA", { bold: true, size: 8 }), AlignmentType.CENTER)],
    { w: Math.round(CONTENT_W * 0.22), vAlign: "center", borders: "outer", ml: 20, mr: 20 }
  );

  const ministryCell = mkCellPara(
    [
      p(t("Ministerio del Poder Popular para la", { size: 9 }), AlignmentType.CENTER),
      p(t("EDUCACIÓN", { bold: true, size: 14 }), AlignmentType.CENTER),
    ],
    { w: Math.round(CONTENT_W * 0.28), vAlign: "center", borders: "outer", ml: 20, mr: 20 }
  );

  const titleCell = mkCellPara(
    [
      p(t("RESUMEN FINAL DEL RENDIMIENTO ESTUDIANTIL", { bold: true, size: 9 }), AlignmentType.CENTER),
      p(t(`Código del Formato: EMG ${tipoPlanilla}`), AlignmentType.RIGHT),
      new Paragraph({
        children: [
          t(`I. Año Escolar: ${data.yearRange}    `),
          t("Tipo de Evaluación: "), t("Final", { bold: true }),
          t(`    Mes y Año: ${h.fecha_remision || "___________"}`),
        ],
        spacing: { before: 0, after: 0 },
      }),
    ],
    { w: CONTENT_W - Math.round(CONTENT_W * 0.22) - Math.round(CONTENT_W * 0.28), vAlign: "center", borders: "outer", ml: 30, mr: 30 }
  );

  return table([mkRow([logoCell, ministryCell, titleCell], 1400)], CONTENT_W);
}

function buildPlantelBlock(data: ResumenFinalDocxData): Table {
  const h = data.schoolHeader;
  const half = Math.round(CONTENT_W * 0.35);
  const rest = CONTENT_W - half;
  const lbl = (text: string, w: number) =>
    mkCell(text, { w, bold: true, shade: "F0F0F0", mt: 20, mb: 20, ml: 50, mr: 50 });
  const val = (text: string, w: number) =>
    mkCell(text, { w, mt: 20, mb: 20, ml: 50, mr: 50 });

  const wLbl1 = Math.round(CONTENT_W * 0.15);
  const wVal1 = Math.round(CONTENT_W * 0.15);
  const wLbl2 = Math.round(CONTENT_W * 0.12);
  const wVal2 = CONTENT_W - wLbl1 - wVal1 - wLbl2;

  return table([
    mkRow([mkCell("II. Datos del Plantel:", { span: 4, w: CONTENT_W, bold: true, shade: "E8E8E8" })], 260),
    mkRow([
      lbl("Código del Plantel:", wLbl1),
      val(h.codigo_plantel || "", wVal1),
      lbl("Nombre:", wLbl2),
      val(h.nombre_plantel || "", wVal2),
    ], 260),
    mkRow([
      lbl("Dirección:", wLbl1),
      val(h.direccion_plantel || "", wVal1),
      lbl("Teléfono:", wLbl2),
      val(h.telefono_plantel || "", wVal2),
    ], 260),
    mkRow([
      lbl("Entidad Federal:", wLbl1),
      val(h.entidad_federal || "", Math.round(wVal1 * 0.6)),
      lbl("Municipio:", Math.round(wLbl2 * 0.8)),
      val(h.municipio_plantel || "", Math.round(wVal2 * 0.6)),
      lbl("Zona Educativa:", Math.round(wLbl2 * 0.9)),
      val(h.zona_educativa || "", CONTENT_W - wLbl1 - Math.round(wVal1 * 0.6) - Math.round(wLbl2 * 0.8) - Math.round(wVal2 * 0.6) - Math.round(wLbl2 * 0.9)),
    ], 260),
    mkRow([
      lbl("Director(a):", wLbl1),
      val(h.director || "", half),
      lbl("Cédula de Identidad:", wLbl2),
      val(h.cedula_director || "", CONTENT_W - wLbl1 - half - wLbl2),
    ], 260),
  ]);
}

function buildStudentTable(data: ResumenFinalDocxData): Table {
  const { regularSubjects, gcrpSubjects, students } = data;
  const allNoteSubjects: SubjectCol[] = [...regularSubjects, ...gcrpSubjects];
  const noteCount = allNoteSubjects.length;

  const W_GRUPO = Math.max(600, RIGHT_TOTAL - noteCount * Math.floor((RIGHT_TOTAL - 600) / Math.max(noteCount, 1)));
  const W_NOTE = noteCount > 0 ? Math.floor((RIGHT_TOTAL - W_GRUPO) / noteCount) : 0;
  const W_GRUPO_ACTUAL = RIGHT_TOTAL - noteCount * W_NOTE; // absorb rounding

  // Build total col widths array
  const colWidths = [
    W_NRO, W_CED, W_APE, W_NOM, W_LUG, W_EF, W_SEX, W_DIA, W_MES, W_ANO,
    ...Array(regularSubjects.length).fill(W_NOTE),
    ...(gcrpSubjects.length > 0 ? Array(gcrpSubjects.length).fill(W_NOTE) : []),
    W_GRUPO_ACTUAL,
  ];

  const sumSpan = (start: number, count: number) =>
    colWidths.slice(start, start + count).reduce((a, b) => a + b, 0);

  const TOTAL_COLS = colWidths.length;
  const rightCount = noteCount + 1; // note cols + grupo
  const H_HEADER = 280;
  const H_DATA = 230;
  const H_SUM = 220;

  const hdrShade = "DDEEFF";
  const subHdrShade = "EEF5FF";

  // ─── header row 1: section titles ─────────────────────────────────
  const hRow1 = mkRow([
    mkCell("III. Identificación del Estudiante:", {
      span: 10, w: LEFT_TOTAL, bold: true, align: AlignmentType.LEFT,
      shade: hdrShade, vAlign: "center",
    }),
    mkCell("IV. Resumen Final del Rendimiento:", {
      span: rightCount, w: RIGHT_TOTAL, bold: true, align: AlignmentType.LEFT,
      shade: hdrShade, vAlign: "center",
    }),
  ], H_HEADER);

  // ─── header row 2: column group titles ────────────────────────────
  const hRow2Cells: TableCell[] = [
    mkCell("", { w: W_NRO, shade: subHdrShade }),
    mkCell("", { w: W_CED, shade: subHdrShade }),
    mkCell("", { w: W_APE, shade: subHdrShade }),
    mkCell("", { w: W_NOM, shade: subHdrShade }),
    mkCell("", { w: W_LUG, shade: subHdrShade }),
    mkCell("", { w: W_EF, shade: subHdrShade }),
    mkCell("", { w: W_SEX, shade: subHdrShade }),
    mkCell("Fecha de nacimiento", {
      span: 3, w: W_DIA + W_MES + W_ANO,
      align: AlignmentType.CENTER, bold: true, shade: subHdrShade, vAlign: "center",
    }),
    mkCell("ÁREAS DE FORMACIÓN — ÁREA COMÚN", {
      span: regularSubjects.length || 1,
      w: sumSpan(10, regularSubjects.length),
      align: AlignmentType.CENTER, bold: true, shade: subHdrShade, vAlign: "center",
    }),
  ];
  if (gcrpSubjects.length > 0) {
    hRow2Cells.push(mkCell("PARTICIPACIÓN EN GRUPOS CREACIÓN, RECREACIÓN Y PRODUCCIÓN", {
      span: gcrpSubjects.length,
      w: sumSpan(10 + regularSubjects.length, gcrpSubjects.length),
      align: AlignmentType.CENTER, bold: true, shade: subHdrShade, vAlign: "center",
    }));
  }
  hRow2Cells.push(mkCell("GRUPO", {
    w: W_GRUPO_ACTUAL,
    align: AlignmentType.CENTER, bold: true, shade: subHdrShade, vAlign: "center",
  }));
  const hRow2 = mkRow(hRow2Cells, H_HEADER);

  // ─── header row 3: column labels ──────────────────────────────────
  const hRow3Cells: TableCell[] = [
    mkCell("N°",      { w: W_NRO, align: AlignmentType.CENTER, bold: true, shade: subHdrShade, vAlign: "center" }),
    mkCell("Cédula de Identidad", { w: W_CED, align: AlignmentType.CENTER, bold: true, shade: subHdrShade, vAlign: "center" }),
    mkCell("Apellidos", { w: W_APE, align: AlignmentType.CENTER, bold: true, shade: subHdrShade, vAlign: "center" }),
    mkCell("Nombres",   { w: W_NOM, align: AlignmentType.CENTER, bold: true, shade: subHdrShade, vAlign: "center" }),
    mkCell("Lugar de nacimiento", { w: W_LUG, align: AlignmentType.CENTER, bold: true, shade: subHdrShade, vAlign: "center" }),
    mkCell("EF",   { w: W_EF,  align: AlignmentType.CENTER, bold: true, shade: subHdrShade, vAlign: "center" }),
    mkCell("sexo", { w: W_SEX, align: AlignmentType.CENTER, bold: true, shade: subHdrShade, vAlign: "center" }),
    mkCell("D",    { w: W_DIA, align: AlignmentType.CENTER, bold: true, shade: subHdrShade, vAlign: "center" }),
    mkCell("M",    { w: W_MES, align: AlignmentType.CENTER, bold: true, shade: subHdrShade, vAlign: "center" }),
    mkCell("A",    { w: W_ANO, align: AlignmentType.CENTER, bold: true, shade: subHdrShade, vAlign: "center" }),
    ...allNoteSubjects.map(s => mkCell(s.abbreviation, {
      w: W_NOTE, align: AlignmentType.CENTER, bold: true, shade: subHdrShade, vAlign: "center",
    })),
    mkCell("",     { w: W_GRUPO_ACTUAL, shade: subHdrShade }),
  ];
  const hRow3 = mkRow(hRow3Cells, H_HEADER);

  // ─── data rows ────────────────────────────────────────────────────
  const dataRows: TableRow[] = [];
  for (let i = 0; i < 35; i++) {
    const row = students[i];
    const nroStr = row ? String(row.nro).padStart(2, "0") : "";
    const cells: TableCell[] = [
      mkCell(nroStr,              { w: W_NRO, align: AlignmentType.CENTER }),
      mkCell(row?.cedula || "",   { w: W_CED, align: AlignmentType.CENTER }),
      mkCell(row?.apellidos || "", { w: W_APE }),
      mkCell(row?.nombres || "",  { w: W_NOM }),
      mkCell(row?.lugarNacimiento || "", { w: W_LUG }),
      mkCell(row?.entidadFederal || "", { w: W_EF, align: AlignmentType.CENTER }),
      mkCell(row?.sexo || "",     { w: W_SEX, align: AlignmentType.CENTER }),
      mkCell(row?.diaNac || "",   { w: W_DIA, align: AlignmentType.CENTER }),
      mkCell(row?.mesNac || "",   { w: W_MES, align: AlignmentType.CENTER }),
      mkCell(row?.anioNac || "",  { w: W_ANO, align: AlignmentType.CENTER }),
      ...allNoteSubjects.map(s => mkCell(row?.grades[s.assignmentId] ?? "", {
        w: W_NOTE, align: AlignmentType.CENTER,
      })),
      mkCell(row?.grupoName || "", { w: W_GRUPO_ACTUAL }),
    ];
    dataRows.push(mkRow(cells, H_DATA));
  }

  // ─── summary rows (5 metrics) ─────────────────────────────────────
  const metrics: Array<{ label: string; fn: (s: SubjectStats) => number | string }> = [
    { label: "Inscritos",     fn: s => s.inscritos },
    { label: "Inasistentes",  fn: s => s.inasistentes },
    { label: "Aprobados",     fn: s => s.aprobados },
    { label: "No Aprobados",  fn: s => s.noAprobados },
    { label: "No Cursaron",   fn: _ => 35 - data.studentsInPage },
  ];

  const subjectStatsList = allNoteSubjects.map(s => computeSubjectStats(s, data));

  const summaryRows: TableRow[] = metrics.map((m, idx) => {
    const isFirst = idx === 0;
    const cells: TableCell[] = [
      // "Total de Áreas de Formación" spans left 7 cols (vertically merged across 5 rows)
      mkCell(isFirst ? "Total de Áreas de Formación" : "", {
        span: 7, w: sumSpan(0, 7),
        vMerge: isFirst ? "restart" : "continue",
        bold: isFirst, align: AlignmentType.CENTER, vAlign: "center",
      }),
      // metric label spans 3 cols (D, M, A area)
      mkCell(m.label, {
        span: 3, w: sumSpan(7, 3),
        align: AlignmentType.RIGHT, bold: true, vAlign: "center",
      }),
      // per-subject counts
      ...subjectStatsList.map((stats, i) => mkCell(
        String(m.fn(stats)).padStart(2, "0"),
        { w: W_NOTE, align: AlignmentType.CENTER, vAlign: "center" }
      )),
      mkCell("***", { w: W_GRUPO_ACTUAL, align: AlignmentType.CENTER, vAlign: "center" }),
    ];
    return mkRow(cells, H_SUM);
  });

  return table([hRow1, hRow2, hRow3, ...dataRows, ...summaryRows]);
}

function buildTeacherAndCourseBlock(data: ResumenFinalDocxData): Table {
  const allSubjects: SubjectCol[] = [...data.regularSubjects, ...data.gcrpSubjects];
  const leftW = Math.round(CONTENT_W * 0.60);
  const rightW = CONTENT_W - leftW;

  // ─── Section V: teachers table ─────────────────────────────────
  const tblTeachW = leftW;
  const wNro    = Math.round(tblTeachW * 0.05);
  const wAbr    = Math.round(tblTeachW * 0.07);
  const wArea   = Math.round(tblTeachW * 0.30);
  const wNomDoc = Math.round(tblTeachW * 0.30);
  const wCed    = Math.round(tblTeachW * 0.18);
  const wFirma  = tblTeachW - wNro - wAbr - wArea - wNomDoc - wCed;

  const teacherTable = table([
    mkRow([mkCell("V. Profesores por Áreas:", { span: 6, w: tblTeachW, bold: true, shade: "E8E8E8" })], 260),
    mkRow([
      mkCell("N°",   { w: wNro,    bold: true, shade: "F0F0F0", align: AlignmentType.CENTER }),
      mkCell("",     { w: wAbr,    bold: true, shade: "F0F0F0" }),
      mkCell("Áreas de Formación", { w: wArea, bold: true, shade: "F0F0F0" }),
      mkCell("Apellidos y Nombres del Profesor", { w: wNomDoc, bold: true, shade: "F0F0F0" }),
      mkCell("Cédula de Identidad", { w: wCed, bold: true, shade: "F0F0F0" }),
      mkCell("Firma", { w: wFirma, bold: true, shade: "F0F0F0" }),
    ], 270),
    ...allSubjects.map((s, i) => mkRow([
      mkCell(String(i + 1), { w: wNro, align: AlignmentType.CENTER }),
      mkCell(s.abbreviation, { w: wAbr, align: AlignmentType.CENTER }),
      mkCell(s.name.toUpperCase(), { w: wArea }),
      mkCell(s.teacherName, { w: wNomDoc }),
      mkCell(s.teacherCedula, { w: wCed }),
      mkCell("", { w: wFirma }),
    ], 260)),
  ], tblTeachW);

  // ─── Section VI: course identification ─────────────────────────
  const wLbl = Math.round(rightW * 0.62);
  const wVal = rightW - wLbl;
  const gradeLabel = GRADE_PLAN_LABEL[data.sectionGradeLevel] ?? data.sectionGradeLevel.toUpperCase();

  const courseTable = table([
    mkRow([mkCell("VI. Identificación del Curso:", { span: 2, w: rightW, bold: true, shade: "E8E8E8" })], 260),
    mkRow([mkCell("PLAN DE ESTUDIO", { w: wLbl, bold: true, shade: "F0F0F0" }), mkCell("EDUCACIÓN MEDIA GENERAL", { w: wVal })], 260),
    mkRow([mkCell("CÓDIGO",     { w: wLbl, bold: true, shade: "F0F0F0" }), mkCell(data.tipoPlanilla, { w: wVal })], 260),
    mkRow([mkCell("AÑO CURSADO", { w: wLbl, bold: true, shade: "F0F0F0" }), mkCell(gradeLabel, { w: wVal })], 260),
    mkRow([mkCell("SECCIÓN",    { w: wLbl, bold: true, shade: "F0F0F0" }), mkCell(data.sectionName, { w: wVal })], 260),
    mkRow([mkCell("N° DE ESTUDIANTES POR SECCIÓN", { w: wLbl, bold: true, shade: "F0F0F0" }), mkCell(String(data.totalStudentsInSection), { w: wVal })], 260),
    mkRow([mkCell("N° DE ESTUDIANTES EN LA PÁGINA", { w: wLbl, bold: true, shade: "F0F0F0" }), mkCell(String(data.studentsInPage), { w: wVal })], 260),
  ], rightW);

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: leftW, type: WidthType.DXA },
            children: [teacherTable],
            borders: BORDERS_NONE,
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
          }),
          new TableCell({
            width: { size: rightW, type: WidthType.DXA },
            children: [courseTable],
            borders: BORDERS_NONE,
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
          }),
        ],
      }),
    ],
    borders: BORDERS_NONE,
  });
}

function buildObservacionesBlock(data: ResumenFinalDocxData): Table {
  return table([
    mkRow([mkCell("VII. Observaciones:", { span: 1, w: CONTENT_W, bold: true, shade: "E8E8E8" })], 260),
    mkRow([mkCell(data.observaciones || "", { w: CONTENT_W, mt: 40, mb: 80 })], 500),
  ]);
}

function buildSignaturesBlock(data: ResumenFinalDocxData): Table {
  const h = data.schoolHeader;
  const wLeft  = Math.round(CONTENT_W * 0.37);
  const wSello = Math.round(CONTENT_W * 0.13);
  const wMid   = Math.round(CONTENT_W * 0.37);
  const wRight = CONTENT_W - wLeft - wSello - wMid;

  const lbl = (text: string, w: number) =>
    mkCell(text, { w, bold: true, shade: "F0F0F0", mt: 20, mb: 20, ml: 40 });
  const val = (text: string, w: number) =>
    mkCell(text, { w, mt: 20, mb: 20, ml: 40 });

  // Vertical-merge helpers for stamp cells
  const selloMrg = (vMerge: VerticalMergeType, content?: string) =>
    new TableCell({
      width: { size: wSello, type: WidthType.DXA },
      verticalMerge: vMerge,
      children: content ? [p(t(content, { bold: true }), AlignmentType.CENTER)] : [emptyP()],
      borders: BORDERS_ALL,
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 20, bottom: 20, left: 20, right: 20 },
    });

  const sello2Mrg = (vMerge: VerticalMergeType, content?: string) =>
    new TableCell({
      width: { size: wRight, type: WidthType.DXA },
      verticalMerge: vMerge,
      children: content ? [p(t(content, { bold: true }), AlignmentType.CENTER)] : [emptyP()],
      borders: BORDERS_ALL,
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 20, bottom: 20, left: 20, right: 20 },
    });

  return table([
    mkRow([
      mkCell("VIII. Fecha de Remisión:", { w: wLeft + wSello, span: 2, bold: true, shade: "E8E8E8" }),
      mkCell("IX. Fecha de Recepción:", { w: wMid + wRight, span: 2, bold: true, shade: "E8E8E8" }),
    ], 260),
    mkRow([
      mkCell(h.fecha_remision || "", { w: wLeft, mt: 20, mb: 20, ml: 40 }),
      selloMrg(VerticalMergeType.RESTART, "SELLO DEL PLANTEL"),
      mkCell("", { w: wMid }),
      sello2Mrg(VerticalMergeType.RESTART, "SELLO DE LA ZONA EDUCATIVA"),
    ], 280),
    mkRow([
      lbl("Director(a)", wLeft),
      selloMrg(VerticalMergeType.CONTINUE),
      lbl("Funcionario Receptor", wMid),
      sello2Mrg(VerticalMergeType.CONTINUE),
    ], 260),
    mkRow([
      lbl("Apellidos y Nombres:", wLeft),
      selloMrg(VerticalMergeType.CONTINUE),
      lbl("Apellidos y Nombres:", wMid),
      sello2Mrg(VerticalMergeType.CONTINUE),
    ], 260),
    mkRow([
      val(h.director || "", wLeft),
      selloMrg(VerticalMergeType.CONTINUE),
      val("", wMid),
      sello2Mrg(VerticalMergeType.CONTINUE),
    ], 260),
    mkRow([
      lbl("Cédula de Identidad:", wLeft),
      mkCell("", { w: wSello }),
      lbl("Cédula de Identidad:", wMid),
      mkCell("", { w: wRight }),
    ], 260),
    mkRow([
      val(h.cedula_director || "", wLeft),
      mkCell("", { w: wSello }),
      val("", wMid),
      mkCell("", { w: wRight }),
    ], 260),
    mkRow([
      lbl("Firma:", wLeft),
      mkCell("", { w: wSello, mt: 30, mb: 100 }),
      lbl("Firma:", wMid),
      mkCell("", { w: wRight, mt: 30, mb: 100 }),
    ], 500),
  ]);
}

// ─── spacing paragraph between blocks ───────────────────────────────
const spacePara = () => new Paragraph({ children: [], spacing: { before: 60, after: 60 } });
const pageBreakPara = () => new Paragraph({ children: [new PageBreak()], spacing: { before: 0, after: 0 } });

// ─── build content for one section ──────────────────────────────────
async function buildSectionContent(
  data: ResumenFinalDocxData,
  logoBuffer: ArrayBuffer | null
): Promise<(Paragraph | Table)[]> {
  return [
    await buildHeaderBlock(data, logoBuffer),
    spacePara(),
    buildPlantelBlock(data),
    spacePara(),
    buildStudentTable(data),
    spacePara(),
    buildTeacherAndCourseBlock(data),
    spacePara(),
    buildObservacionesBlock(data),
    spacePara(),
    buildSignaturesBlock(data),
  ];
}

// ─── main export ─────────────────────────────────────────────────────
export async function generateResumenFinalDocx(
  sections: ResumenFinalDocxData | ResumenFinalDocxData[]
): Promise<Blob> {
  const dataArray = Array.isArray(sections) ? sections : [sections];

  // fetch logo once
  let logoBuffer: ArrayBuffer | null = null;
  try {
    const res = await fetch(LOGO_URL);
    if (res.ok) logoBuffer = await res.arrayBuffer();
  } catch {
    // skip logo if fetch fails
  }

  const allContent: (Paragraph | Table)[] = [];
  for (let i = 0; i < dataArray.length; i++) {
    if (i > 0) allContent.push(pageBreakPara());
    const blocks = await buildSectionContent(dataArray[i], logoBuffer);
    allContent.push(...blocks);
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Times New Roman", size: 20 },
          paragraph: { spacing: { before: 0, after: 0 } },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_W, height: PAGE_H },
          margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
        },
      },
      children: allContent,
    }],
  });

  return Packer.toBlob(doc);
}

// ─── download helper ─────────────────────────────────────────────────
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
