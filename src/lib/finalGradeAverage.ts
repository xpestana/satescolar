/**
 * Definitiva final numérica a partir de las notas de los momentos 1, 2 y 3.
 * La usan bachillerato (`final_grades`) y primaria (`primary_final_reports.literal_numerico`).
 */

type MomentValue = string | number | null | undefined;

function toGrade(value: MomentValue): number | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return isNaN(n) ? null : n;
}

/**
 * Definitiva que se propone mientras no haya una guardada: la suma de los momentos entre 3,
 * contando como 0 el momento sin nota (mismo criterio que bachillerato). Sin ninguna nota → "".
 */
export function proposeFinalGrade(momentValues: MomentValue[]): string {
  const grades = momentValues.map(toGrade);
  if (grades.every((g) => g === null)) return "";
  const sum = grades.reduce<number>((acc, g) => acc + (g ?? 0), 0);
  return (sum / 3).toFixed(2);
}

/** Promedio de los tres momentos, solo cuando los tres tienen nota; si falta alguno → null. */
export function completeMomentsAverage(momentValues: MomentValue[]): string | null {
  const grades = momentValues.map(toGrade);
  if (grades.length !== 3 || grades.some((g) => g === null)) return null;
  return ((grades as number[]).reduce((a, b) => a + b, 0) / 3).toFixed(2);
}

/** La definitiva actual ya no coincide con el promedio de los momentos (a 2 decimales). */
export function isFinalGradeStale(current: string, recalculated: string | null): boolean {
  const cur = current.trim();
  if (!cur || recalculated === null) return false;
  return Number(cur).toFixed(2) !== Number(recalculated).toFixed(2);
}
