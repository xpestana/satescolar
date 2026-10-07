/** Formato numérico para boleta (zero-padding en enteros < 10). */
export function fmtGradeNum(n: number): string {
  if (Number.isInteger(n)) return n < 10 ? `0${n}` : String(n);
  return n.toFixed(2);
}

/** Tabulación literal bachillerato: A 19–20, B 16–18, C 13–15, D ≤12. */
export function numericToLiteralGrade(n: number): string {
  const score = Math.round(n);
  if (score >= 19) return "A";
  if (score >= 16) return "B";
  if (score >= 13) return "C";
  return "D";
}

/**
 * Literal de primaria según la nota numérica (redondeada a entero):
 * A 19–20, B 16–18, C 13–15, D 10–12, E 01–09. Vacío o fuera de 0–20 → "".
 */
export function primaryLiteralFromGrade(value: string | number | null | undefined): string {
  const s = String(value ?? "").trim();
  if (!s) return "";
  const n = Number(s);
  if (isNaN(n) || n < 0 || n > 20) return "";
  const score = Math.round(n);
  if (score >= 19) return "A";
  if (score >= 16) return "B";
  if (score >= 13) return "C";
  if (score >= 10) return "D";
  return "E";
}

export function formatBoletaGradeValue(
  n: number,
  evaluationType: string | undefined,
): string {
  if (evaluationType === "literal") return numericToLiteralGrade(n);
  return fmtGradeNum(n);
}

/** Nota para planilla Resumen Final (31059/31060): literal como en boleta (A–D); sin nota → vacío. */
export function formatResumenFinalGrade(
  gradeValue: string | null,
  adjPoints: number,
  evalType: string,
): string {
  if (gradeValue == null || String(gradeValue).trim() === "") return "";
  const num = parseFloat(gradeValue) + (adjPoints ?? 0);
  if (isNaN(num)) return "";
  if (evalType === "literal") return formatBoletaGradeValue(num, evalType);
  // Redondeo básico a entero: 19.5 → 20, 18.2 → 18 (Math.round = mitad hacia arriba).
  // El entero pasa por fmtGradeNum para que las notas de un dígito lleven cero delante
  // (9 → "09"), igual que en la boleta.
  return fmtGradeNum(Math.round(num));
}
