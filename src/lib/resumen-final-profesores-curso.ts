import {
  AlignmentType,
  BorderStyle,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  WidthType,
  VerticalAlign,
  type ITableBordersOptions,
} from "docx";
import type { ResumenFinalDocxData } from "@/hooks/useResumenFinalDocxData";

export const FOOT_V_HDR_H = 252;
export const FOOT_V_DATA_H = 412;

const BS = { style: BorderStyle.SINGLE, size: 4, color: "000000" } as const;
const BN = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } as const;
/** Solo divisor vertical entre conteos; sin borde inferior interno. */
const BORDERS_STUDENTS_PAIR: ITableBordersOptions = {
  top: BN,
  bottom: BN,
  left: BN,
  right: BN,
  insideHorizontal: BN,
  insideVertical: BS,
};

/** VI comienza tras las primeras N columnas de materias (5ª casilla = índice 4). */
export const VI_START_AFTER_IV_COLS = 4;

export type ProfesoresCursoLayout = {
  stTableW: number;
  stColIii: number;
  stColIv: number;
  ivMateriaW: number;
  stIvCols: number[];
};

export type BuildProfesoresCursoDeps = {
  rowH: (baseHeight: number) => number;
  mkStHdrRow: (cells: TableCell[], minHeight: number) => TableRow;
  mkFooterDataCell: (
    w: number,
    text: string,
    opts?: {
      bold?: boolean;
      align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    },
  ) => TableCell;
  tblFooterP: (
    text: string,
    opts?: {
      bold?: boolean;
      align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    },
  ) => import("docx").Paragraph;
  gradeLabelUpper: (gradeLevel: string) => string;
  bordersGrid: ITableBordersOptions;
  bordersNestedGrid: ITableBordersOptions;
};

export function estimateProfesoresBlockHeight(
  nRegular: number,
  nProductive: number,
): number {
  return FOOT_V_HDR_H * 2 + (nRegular + nProductive) * FOOT_V_DATA_H;
}

type ViSlot = { type: "label" | "value"; text: string };

export type ViRowContent =
  | { kind: "stack"; label: string; value: string }
  | {
      kind: "studentsPair";
      sectionLabel: string;
      sectionValue: string;
      pageLabel: string;
      pageValue: string;
    };

function buildCursoFieldSlots(
  data: ResumenFinalDocxData,
  gradeLabelUpper: (gradeLevel: string) => string,
): ViSlot[] {
  const pairs: [string, string][] = [
    ["PLAN DE ESTUDIO:", data.planEstudio.toUpperCase()],
    ["CÓDIGO:", data.tipoPlanilla],
    ["AÑO CURSADO", gradeLabelUpper(data.sectionGradeLevel)],
    ["SECCIÓN", data.sectionName.toUpperCase()],
    ["N° DE ESTUDIANTES POR SECCIÓN", String(data.totalStudentsInSection)],
    ["N° DE ESTUDIANTES EN ESTA PÁGINA", String(data.studentsInPage)],
  ];
  const slots: ViSlot[] = [];
  for (const [label, value] of pairs) {
    slots.push({ type: "label", text: label });
    slots.push({ type: "value", text: value });
  }
  return slots;
}

/** Slots 1–7: datos del curso (un slot por fila); fila final = conteos en dos columnas. */
const FIRST_DATA_SLOT = 1;
const LAST_VERTICAL_SLOT = 7;
const STUDENTS_SECTION_LABEL_SLOT = 8;
const STUDENTS_SECTION_VALUE_SLOT = 9;
const STUDENTS_PAGE_LABEL_SLOT = 10;
const STUDENTS_PAGE_VALUE_SLOT = 11;

export function assignViToRows(nRows: number, slots: ViSlot[]): ViRowContent[] {
  const rows: ViRowContent[] = Array.from({ length: nRows }, () => ({
    kind: "stack",
    label: "",
    value: "",
  }));
  if (nRows === 0) return rows;

  const lastRow = nRows - 1;
  const verticalRows = Math.max(0, nRows - 1);

  for (let row = 0; row < verticalRows; row++) {
    const slotIdx = row + FIRST_DATA_SLOT;
    if (slotIdx > LAST_VERTICAL_SLOT) break;
    const slot = slots[slotIdx];
    const entry = rows[row];
    if (entry.kind !== "stack") continue;
    if (slot.type === "label") entry.label = slot.text;
    else entry.value = slot.text;
  }

  rows[lastRow] = {
    kind: "studentsPair",
    sectionLabel: slots[STUDENTS_SECTION_LABEL_SLOT]?.text ?? "",
    sectionValue: slots[STUDENTS_SECTION_VALUE_SLOT]?.text ?? "",
    pageLabel: slots[STUDENTS_PAGE_LABEL_SLOT]?.text ?? "",
    pageValue: slots[STUDENTS_PAGE_VALUE_SLOT]?.text ?? "",
  };

  return rows;
}

function viHeaderLabel(slots: ViSlot[]): string {
  return slots[0]?.type === "label" ? slots[0].text : "";
}

export function computeViStartOffset(
  stIvCols: number[],
  afterCols = VI_START_AFTER_IV_COLS,
): number {
  return stIvCols.slice(0, afterCols).reduce((a, b) => a + b, 0);
}

/** V ocupa III + primeras N materias; VI ocupa el resto de IV (desde 5ª materia). */
export function computeColumnWidths(
  stColIii: number,
  stColIv: number,
  ivMateriaW: number,
  stIvCols: number[],
): { vCols: number[]; viW: number; vW: number; allCols: number[] } {
  const offset = Math.min(computeViStartOffset(stIvCols), stColIv);
  const vW = stColIii + offset;
  const viW = stColIv - offset;
  const colNro = 340;
  const colSigla = 700;
  const colCedula = 1500;
  const colFirma = 2 * ivMateriaW;
  const colProfesorBase = 3600;
  const colProfesor = colProfesorBase + Math.round((vW - stColIii) * 0.55);
  // Remanente para que la suma de V coincida con vW (evita deformar Word)
  const colArea = vW - colNro - colSigla - colProfesor - colCedula - colFirma;
  const vCols = [colNro, colSigla, colArea, colProfesor, colCedula, colFirma];
  return { vCols, viW, vW, allCols: [...vCols, viW] };
}

function mkFooterHeaderMergedCell(
  w: number,
  text: string,
  deps: BuildProfesoresCursoDeps,
): TableCell {
  return new TableCell({
    columnSpan: 2,
    width: { size: w, type: WidthType.DXA },
    children: [deps.tblFooterP(text, { bold: true })],
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 4, bottom: 4, left: 6, right: 4 },
  });
}

function studentsPairFromSlots(slots: ViSlot[]) {
  return {
    sectionLabel: slots[STUDENTS_SECTION_LABEL_SLOT]?.text ?? "",
    sectionValue: slots[STUDENTS_SECTION_VALUE_SLOT]?.text ?? "",
    pageLabel: slots[STUDENTS_PAGE_LABEL_SLOT]?.text ?? "",
    pageValue: slots[STUDENTS_PAGE_VALUE_SLOT]?.text ?? "",
  };
}

function mkViStudentsFieldCell(
  w: number,
  label: string,
  value: string,
  deps: BuildProfesoresCursoDeps,
): TableCell {
  const children: import("docx").Paragraph[] = [];
  if (label) {
    children.push(
      deps.tblFooterP(label, { bold: true, align: AlignmentType.CENTER }),
    );
  }
  if (value) {
    children.push(deps.tblFooterP(value, { align: AlignmentType.CENTER }));
  }
  if (children.length === 0) {
    children.push(deps.tblFooterP(""));
  }

  return new TableCell({
    width: { size: w, type: WidthType.DXA },
    children,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 4, bottom: 4, left: 4, right: 4 },
    borders: {
      top: BN,
      bottom: BN,
      left: BN,
      right: BN,
    },
  });
}

function mkViFieldCell(
  w: number,
  label: string,
  value: string,
  deps: BuildProfesoresCursoDeps,
): TableCell {
  const children: import("docx").Paragraph[] = [];
  if (label) {
    children.push(
      deps.tblFooterP(label, { bold: true, align: AlignmentType.CENTER }),
    );
  }
  if (value) {
    children.push(deps.tblFooterP(value, { align: AlignmentType.CENTER }));
  }
  if (children.length === 0) {
    children.push(deps.tblFooterP(""));
  }

  return new TableCell({
    width: { size: w, type: WidthType.DXA },
    children,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 4, bottom: 4, left: 4, right: 4 },
  });
}

function mkViStudentsPairCell(
  viW: number,
  slots: ViSlot[],
  deps: BuildProfesoresCursoDeps,
  rowSpan = 1,
): TableCell {
  const { sectionLabel, sectionValue, pageLabel, pageValue } =
    studentsPairFromSlots(slots);
  const halfW = Math.floor(viW / 2);
  const remainder = viW - halfW;
  const innerRowH = rowSpan * deps.rowH(FOOT_V_DATA_H);

  const inner = new Table({
    width: { size: viW, type: WidthType.DXA },
    columnWidths: [halfW, remainder],
    layout: TableLayoutType.FIXED,
    borders: BORDERS_STUDENTS_PAIR,
    rows: [
      deps.mkStHdrRow(
        [
          mkViStudentsFieldCell(halfW, sectionLabel, sectionValue, deps),
          mkViStudentsFieldCell(remainder, pageLabel, pageValue, deps),
        ],
        innerRowH,
      ),
    ],
  });

  return new TableCell({
    rowSpan,
    width: { size: viW, type: WidthType.DXA },
    children: [inner],
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    borders: {
      top: BN,
      bottom: BN,
      left: BN,
      right: BN,
    },
  });
}

/** Fusiona filas VI vacías consecutivas + fila final de conteo de estudiantes. */
function studentsMergeSpan(viRows: ViRowContent[]): {
  startRow: number;
  rowSpan: number;
} {
  const lastRow = viRows.length - 1;
  if (lastRow < 0) return { startRow: 0, rowSpan: 0 };

  let startRow = lastRow;
  for (let i = lastRow - 1; i >= 0; i--) {
    const row = viRows[i];
    if (row.kind === "stack" && !row.label && !row.value) {
      startRow = i;
    } else {
      break;
    }
  }
  return { startRow, rowSpan: lastRow - startRow + 1 };
}

function mkViCell(
  viW: number,
  content: ViRowContent,
  deps: BuildProfesoresCursoDeps,
): TableCell {
  if (content.kind !== "stack") {
    throw new Error("mkViCell espera contenido stack");
  }
  return mkViFieldCell(viW, content.label, content.value, deps);
}

export function buildProfesoresCursoTable(
  data: ResumenFinalDocxData,
  layout: ProfesoresCursoLayout,
  deps: BuildProfesoresCursoDeps,
): Table {
  const { vCols, viW, vW, allCols } = computeColumnWidths(
    layout.stColIii,
    layout.stColIv,
    layout.ivMateriaW,
    layout.stIvCols,
  );
  const allSubjects = [...data.regularSubjects, ...data.productiveSubjects];
  const slots = buildCursoFieldSlots(data, deps.gradeLabelUpper);
  const viRows = assignViToRows(allSubjects.length, slots);
  const headerViLabel = viHeaderLabel(slots);
  const { startRow: mergeStart, rowSpan: mergeSpan } =
    studentsMergeSpan(viRows);

  const titleRow = deps.mkStHdrRow(
    [
      new TableCell({
        columnSpan: 6,
        width: { size: vW, type: WidthType.DXA },
        children: [deps.tblFooterP("V. Profesores por Áreas:", { bold: true })],
        margins: { top: 4, bottom: 4, left: 6, right: 4 },
      }),
      new TableCell({
        width: { size: viW, type: WidthType.DXA },
        children: [
          deps.tblFooterP("VI. Identificación del Curso:", { bold: true }),
        ],
        margins: { top: 4, bottom: 4, left: 6, right: 4 },
      }),
    ],
    deps.rowH(FOOT_V_HDR_H),
  );

  const headerRow = deps.mkStHdrRow(
    [
      deps.mkFooterDataCell(vCols[0], "N°", {
        bold: true,
        align: AlignmentType.CENTER,
      }),
      mkFooterHeaderMergedCell(vCols[1] + vCols[2], "Áreas de Formación", deps),
      deps.mkFooterDataCell(vCols[3], "Apellidos y Nombres del Profesor", {
        bold: true,
      }),
      deps.mkFooterDataCell(vCols[4], "Cedula de Identidad", {
        bold: true,
        align: AlignmentType.CENTER,
      }),
      deps.mkFooterDataCell(vCols[5], "Firma", {
        bold: true,
        align: AlignmentType.CENTER,
      }),
      mkViFieldCell(viW, headerViLabel, "", deps),
    ],
    deps.rowH(FOOT_V_HDR_H),
  );

  const dataRows = allSubjects.map((s, i) => {
    const cells: TableCell[] = [
      deps.mkFooterDataCell(vCols[0], String(i + 1), {
        align: AlignmentType.CENTER,
      }),
      deps.mkFooterDataCell(vCols[1], s.abbreviation.toUpperCase(), {
        align: AlignmentType.CENTER,
      }),
      deps.mkFooterDataCell(vCols[2], s.name.toUpperCase()),
      deps.mkFooterDataCell(vCols[3], s.teacherName),
      deps.mkFooterDataCell(vCols[4], s.teacherCedula, {
        align: AlignmentType.CENTER,
      }),
      deps.mkFooterDataCell(vCols[5], ""),
    ];

    if (i >= mergeStart && i < mergeStart + mergeSpan) {
      if (i === mergeStart) {
        cells.push(
          mkViStudentsPairCell(viW, slots, deps, mergeSpan),
        );
      }
    } else {
      cells.push(mkViCell(viW, viRows[i], deps));
    }

    return deps.mkStHdrRow(cells, deps.rowH(FOOT_V_DATA_H));
  });

  return new Table({
    width: { size: layout.stTableW, type: WidthType.DXA },
    columnWidths: allCols,
    layout: TableLayoutType.FIXED,
    borders: deps.bordersNestedGrid,
    rows: [titleRow, headerRow, ...dataRows],
  });
}
