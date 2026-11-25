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

export interface SexColumnsOptions {
  /** Adds the "S/D" (sex not recorded) column. Only when some student lacks it. */
  showUnknownSex: boolean;
}

function sexHead(firstColumn: string, { showUnknownSex }: SexColumnsOptions): string[] {
  return [firstColumn, "M", "F", ...(showUnknownSex ? [UNKNOWN_SEX_LABEL] : []), "Total"];
}

function sexCells(label: ReportCell, counts: SexCount, { showUnknownSex }: SexColumnsOptions): ReportCell[] {
  return [label, counts.male, counts.female, ...(showUnknownSex ? [counts.unknown] : []), counts.total];
}

/** Label + value in the last column, blanks in between (summary rows under the age table). */
function summaryRow(label: string, value: number, width: number): ReportCell[] {
  return [label, ...Array<ReportCell>(width - 2).fill(""), value];
}

export function demographicsTable(block: DemographicsBlock, options: SexColumnsOptions): ReportTable {
  const head = sexHead("Edad", options);
  const width = head.length;
  const body = block.ages.map((a) => sexCells(a.age ?? NO_BIRTH_DATE_LABEL, a.counts, options));
  const documents: [string, number][] = [
    ["CI", block.byDocument.CI],
    ["CE", block.byDocument.CE],
    ["Pasaporte", block.byDocument.P],
  ];
  if (block.byDocument.unknown > 0) documents.push(["Sin documento", block.byDocument.unknown]);

  return {
    title: block.title,
    head,
    body,
    foot: [
      sexCells("TOTAL", block.bySex, options),
      summaryRow("Masculino", block.bySex.male, width),
      summaryRow("Femenino", block.bySex.female, width),
      ...(options.showUnknownSex ? [summaryRow("Sin sexo", block.bySex.unknown, width)] : []),
      ...documents.map(([label, value]) => summaryRow(label, value, width)),
    ],
  };
}

export function answerTable(field: FieldBreakdown, options: SexColumnsOptions): ReportTable {
  return {
    title: field.label,
    head: sexHead("Respuesta", options),
    body: field.answers.map((a) => sexCells(a.label, a.counts, options)),
    foot: [sexCells("TOTAL", field.total, options)],
  };
}

/**
 * Sheets exported to Excel/PDF: the demographics sheet (sections, then grade/group/grand totals,
 * like the official form) and the form answers by sex.
 */
export function buildReportSheets(stats: EnrollmentStats, answers: FieldBreakdown[]): EnrollmentStatsSheet[] {
  const options: SexColumnsOptions = { showUnknownSex: stats.hasUnknownSex };
  const blocks = [...stats.sectionBlocks, ...stats.gradeBlocks, ...stats.groupBlocks, stats.total];
  return [
    {
      name: "Matrícula",
      title: "Matrícula por edad, sexo y documento de identidad",
      tables: blocks.map((block) => demographicsTable(block, options)),
    },
    {
      name: "Respuestas",
      title: "Respuestas del formulario por sexo",
      tables: answers.map((field) => answerTable(field, options)),
    },
  ];
}
