/** Reglas puras de la planilla Resumen Final de primaria (formato RR-DEA-06-04). */

import { fmtGradeNum } from "@/lib/gradeLiteral";

export const PRIMARIA_LITERALS = ["A", "B", "C", "D", "E"] as const;
export type PrimariaLiteral = (typeof PRIMARIA_LITERALS)[number];

export type PrimariaLiteralTotals = Record<PrimariaLiteral, number>;

/** "V-11912910676" → "V 11912910676" (tipo de cédula + número, separados por espacio). */
export function formatPrimariaCedula(documentId: string | null | undefined): string {
  const raw = String(documentId ?? "").trim();
  if (!raw) return "";
  const m = raw.match(/^([A-Za-z]+)\s*[-.\s]?\s*(.+)$/);
  if (!m) return raw;
  return `${m[1].toUpperCase()} ${m[2].trim()}`;
}

/** Literal final normalizado (A–E) o "" si no hay uno válido. */
export function normalizePrimariaLiteral(value: string | null | undefined): PrimariaLiteral | "" {
  const v = String(value ?? "").trim().toUpperCase().charAt(0);
  return (PRIMARIA_LITERALS as readonly string[]).includes(v) ? (v as PrimariaLiteral) : "";
}

/**
 * Nota de la casilla P.: la nota numérica de la definitiva final redondeada a entero, con cero
 * delante si tiene un dígito (como la boleta: 9 → "09"). Sin nota válida (0–20) → "".
 */
export function formatPrimariaNota(value: string | number | null | undefined): string {
  const s = String(value ?? "").trim();
  if (!s) return "";
  const n = Number(s);
  if (isNaN(n) || n < 0 || n > 20) return "";
  return fmtGradeNum(Math.round(n));
}

export type PrimariaFinalReport = {
  student_id: string;
  literal: string | null;
  literal_numerico: number | string | null;
};

export type PrimariaFinalResult = { literal: PrimariaLiteral | ""; nota: string };

/**
 * Literal y nota de la definitiva final por estudiante. El informe puede estar en cualquier
 * asignación de la sección: gana el primero con literal válido (literal y nota salen del mismo
 * registro); si ninguno tiene literal, la nota del primero que la tenga.
 */
export function pickPrimariaFinalResults(reports: PrimariaFinalReport[]): Map<string, PrimariaFinalResult> {
  const result = new Map<string, PrimariaFinalResult>();
  for (const r of reports) {
    const literal = normalizePrimariaLiteral(r.literal);
    const nota = formatPrimariaNota(r.literal_numerico);
    const current = result.get(r.student_id);
    if (literal && !current?.literal) result.set(r.student_id, { literal, nota });
    else if (!current && nota) result.set(r.student_id, { literal: "", nota });
  }
  return result;
}

/** Totales por literal para la fila TOTAL. */
export function countPrimariaLiterals(literals: Array<string | null | undefined>): PrimariaLiteralTotals {
  const totals: PrimariaLiteralTotals = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (const l of literals) {
    const n = normalizePrimariaLiteral(l);
    if (n) totals[n] += 1;
  }
  return totals;
}

/** Casilla P. de la fila TOTAL: cuántos estudiantes tienen literal (suma de A–E). */
export function sumPrimariaLiteralTotals(totals: PrimariaLiteralTotals): number {
  return PRIMARIA_LITERALS.reduce((sum, l) => sum + totals[l], 0);
}

/** "2_grado" → "2°". */
export function primariaGradeOrdinal(gradeLevel: string): string {
  const m = gradeLevel.match(/^(\d)_grado$/);
  return m ? `${m[1]}°` : gradeLevel;
}

/** Año de cierre del año escolar ("2026-2027" → "2027"). */
function endYear(yearRange: string): string | null {
  const m = yearRange.match(/(\d{4})\s*[-/]\s*(\d{4})/);
  return m ? m[2] : null;
}

/** Mes y año de la evaluación final: julio del año de cierre. */
export function primariaMesAnioEvaluacion(yearRange: string): string {
  const y = endYear(yearRange);
  return y ? `Julio ${y}` : "";
}
