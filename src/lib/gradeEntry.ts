/**
 * Rules for the teacher's grade sheet (`/teacher/materias/:assignmentId/notas`), shared by the
 * desktop table and the phone dialog so both accept and save exactly the same values.
 */

export const MIN_NUMERIC_GRADE = 1;
export const MAX_NUMERIC_GRADE = 20;

/** Whether a value typed in a grade cell can be kept: empty, or 1–20 on numeric sheets. */
export function isAcceptedGradeInput(value: string, numeric: boolean): boolean {
  if (!numeric || value === "") return true;
  const n = Number(value);
  return !Number.isNaN(n) && n >= MIN_NUMERIC_GRADE && n <= MAX_NUMERIC_GRADE;
}

/** Key of a grade in the sheet's `{ [key]: value }` map. */
export function gradeKey(studentId: string, planItemId: string): string {
  return `${studentId}-${planItemId}`;
}

/** One student's grades, by plan item, from the sheet's map (missing = ""). */
export function studentGradeValues(
  grades: Record<string, string>,
  studentId: string,
  planItemIds: string[],
): Record<string, string> {
  return Object.fromEntries(planItemIds.map((id) => [id, grades[gradeKey(studentId, id)] ?? ""]));
}

export interface GradeChange {
  planItemId: string;
  value: string;
}

/** Plan items whose value differs from the saved one, ignoring surrounding spaces. */
export function changedGrades(
  draft: Record<string, string>,
  saved: Record<string, string>,
  planItemIds: string[],
): GradeChange[] {
  return planItemIds
    .filter((id) => (draft[id] ?? "").trim() !== (saved[id] ?? "").trim())
    .map((id) => ({ planItemId: id, value: (draft[id] ?? "").trim() }));
}

/** How many plan items already have a grade. */
export function countFilledGrades(values: Record<string, string>, planItemIds: string[]): number {
  return planItemIds.filter((id) => (values[id] ?? "").trim() !== "").length;
}
