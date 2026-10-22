/**
 * Áreas of a section for the school's diagnosis tab: the main one first (the área whose teacher
 * signs the primaria boleta, `is_main_report`), then in the school's subject order, then by name.
 */

export interface DiagnosisArea {
  assignmentId: string;
  teacherId: string;
  subjectName: string;
  teacherName: string;
  isMain: boolean;
  displayOrder: number | null;
}

export function orderDiagnosisAreas(areas: DiagnosisArea[]): DiagnosisArea[] {
  return [...areas].sort((a, b) => {
    if (a.isMain !== b.isMain) return a.isMain ? -1 : 1;
    const ao = a.displayOrder ?? Number.MAX_SAFE_INTEGER;
    const bo = b.displayOrder ?? Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return a.subjectName.localeCompare(b.subjectName);
  });
}

/** The área selected by default: the main one, or the first. */
export function defaultDiagnosisArea(areas: DiagnosisArea[]): DiagnosisArea | null {
  return orderDiagnosisAreas(areas)[0] ?? null;
}
