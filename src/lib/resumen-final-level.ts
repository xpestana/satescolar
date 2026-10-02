/** Grados de primaria: usan su propia planilla de Resumen Final (no la de bachillerato 31059/31060). */
export const PRIMARY_GRADE_LEVELS = [
  "1_grado",
  "2_grado",
  "3_grado",
  "4_grado",
  "5_grado",
  "6_grado",
] as const;

/** Código (COD) por defecto de la planilla de primaria; editable por sección. */
export const DEFAULT_PRIMARY_COD = "21000";

export function isPrimaryGradeLevel(gradeLevel: string | null | undefined): boolean {
  return (PRIMARY_GRADE_LEVELS as readonly string[]).includes(gradeLevel ?? "");
}

/** Máximo de estudiantes por planilla (parte): primaria 20, bachillerato 35. */
export const PRIMARY_ROWS_PER_PART = 20;
export const BACHILLERATO_ROWS_PER_PART = 35;

export function rowsPerPartFor(gradeLevel: string | null | undefined): number {
  return isPrimaryGradeLevel(gradeLevel) ? PRIMARY_ROWS_PER_PART : BACHILLERATO_ROWS_PER_PART;
}
