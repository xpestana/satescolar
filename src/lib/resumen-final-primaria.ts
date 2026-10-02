/** Reglas puras de la planilla Resumen Final de primaria (formato RR-DEA-06-04). */

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

/** Totales por literal para la fila TOTAL. */
export function countPrimariaLiterals(literals: Array<string | null | undefined>): PrimariaLiteralTotals {
  const totals: PrimariaLiteralTotals = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (const l of literals) {
    const n = normalizePrimariaLiteral(l);
    if (n) totals[n] += 1;
  }
  return totals;
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

/** Fecha de remisión por defecto (igual que bachillerato): 12-07 del año de cierre. */
export function primariaFechaRemision(yearRange: string): string {
  const y = endYear(yearRange);
  return y ? `12-07-${y}` : "";
}
