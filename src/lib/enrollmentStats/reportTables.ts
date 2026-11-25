/**
 * Printable table model shared by the Excel and PDF exports (and mirrored by the on-screen
 * cards), so the three always show the same rows in the same order.
 */
import type { DemographicsBlock, EnrollmentStats, FieldBreakdown, SexCount } from "./enrollmentStatsTypes";

export type ReportCell = string | number;

export interface ReportTable {
  title: string;
  head: string[];
  body: ReportCell[][];
  /** Highlighted rows (totals). */
  foot: ReportCell[][];
}

export interface EnrollmentStatsExportMeta {
  schoolName?: string;
  yearLabel?: string;
  /** Grado/sección filtrados, o "Todos los grados". */
  scopeLabel?: string;
  /** "Fecha de actualización" (edad calculada a esta fecha). */
  dateLabel: string;
}

export interface EnrollmentStatsSheet {
  name: string;
  title: string;
  tables: ReportTable[];
}

export const NO_BIRTH_DATE_LABEL = "Sin fecha";
export const UNKNOWN_SEX_LABEL = "S/D";

/** Rows whose counts are all zero are not printed (keeps 80+ countries or empty ages out). */
const hasStudents = (counts: SexCount) => counts.total > 0;

/** The "S/D" (sex not recorded) column only appears in tables that have such students. */
function sexColumns(firstColumn: string, total: SexCount) {
  const showUnknownSex = total.unknown > 0;
  return {
    head: [firstColumn, "M", "F", ...(showUnknownSex ? [UNKNOWN_SEX_LABEL] : []), "Total"],
    cells: (label: ReportCell, counts: SexCount): ReportCell[] => [
      label,
      counts.male,
      counts.female,
      ...(showUnknownSex ? [counts.unknown] : []),
      counts.total,
    ],
  };
}

/** Label + value in the last column, blanks in between (summary rows under the age table). */
function summaryRow(label: string, value: number, width: number): ReportCell[] {
  return [label, ...Array<ReportCell>(width - 2).fill(""), value];
}

export function demographicsTable(block: DemographicsBlock): ReportTable {
  const ages = block.ages.filter((a) => hasStudents(a.counts));
  const { head, cells } = sexColumns("Edad", block.bySex);
  const summary: [string, number][] = [
    ["Masculino", block.bySex.male],
    ["Femenino", block.bySex.female],
    ["Sin sexo", block.bySex.unknown],
    ["CI", block.byDocument.CI],
    ["CE", block.byDocument.CE],
    ["Pasaporte", block.byDocument.P],
    ["Sin documento", block.byDocument.unknown],
  ];

  return {
    title: block.title,
    head,
    body: ages.map((a) => cells(a.age ?? NO_BIRTH_DATE_LABEL, a.counts)),
    foot: [
      cells("TOTAL", block.bySex),
      ...summary.filter(([, value]) => value > 0).map(([label, value]) => summaryRow(label, value, head.length)),
    ],
  };
}

export function answerTable(field: FieldBreakdown): ReportTable {
  const { head, cells } = sexColumns("Respuesta", field.total);
  return {
    title: field.label,
    head,
    body: field.answers.filter((a) => hasStudents(a.counts)).map((a) => cells(a.label, a.counts)),
    foot: [cells("TOTAL", field.total)],
  };
}

/**
 * Sheets exported to Excel/PDF: the demographics sheet (sections, then grade/group/grand totals,
 * like the official form) and the form answers by sex. Fields nobody answered are left out.
 */
export function buildReportSheets(stats: EnrollmentStats, answers: FieldBreakdown[]): EnrollmentStatsSheet[] {
  const blocks = [...stats.sectionBlocks, ...stats.gradeBlocks, ...stats.groupBlocks, stats.total];
  return [
    {
      name: "Matrícula",
      title: "Matrícula por edad, sexo y documento de identidad",
      tables: blocks.map(demographicsTable),
    },
    {
      name: "Respuestas",
      title: "Respuestas del formulario por sexo",
      tables: answers.filter((field) => hasStudents(field.total)).map(answerTable),
    },
  ];
}
