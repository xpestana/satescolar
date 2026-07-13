import type { StudentDocxRow, SubjectCol, SubjectAreaTotals } from "@/hooks/useResumenFinalDocxData";

export type SubjectGradeRecord = {
  student_id: string;
  assignment_id: string;
  grade_value: string | null;
  adjustment_points: number;
  final_status: string | null;
  absence_count: number | null;
  attendance_count: number | null;
};

const PASSING_GRADE = 10;

const EMPTY_SUBJECT_TOTALS: SubjectAreaTotals = {
  inscritos: 0,
  inasistentes: 0,
  asistentes: 0,
  aprobados: 0,
  noAprobados: 0,
  noCursantes: 0,
};

/** Nota definitiva numérica (nota + ajuste) desde el registro guardado. */
function subjectNumericFinal(g: SubjectGradeRecord | undefined): number | null {
  if (!g || g.grade_value == null || String(g.grade_value).trim() === "") return null;
  const nota = parseFloat(String(g.grade_value).replace(",", "."));
  if (isNaN(nota)) return null;
  return nota + (g.adjustment_points ?? 0);
}

/** Aprobado: 10 o más. Reprobado: 9 o menos. */
function isAprobado(finalGrade: number): boolean {
  return finalGrade >= PASSING_GRADE;
}

export function computeSubjectAreaTotals(
  pageStudentIds: string[],
  studentRows: StudentDocxRow[],
  subjects: SubjectCol[],
  gradeMap: Map<string, SubjectGradeRecord>,
): Record<string, SubjectAreaTotals> {
  const result: Record<string, SubjectAreaTotals> = {};
  for (const subj of subjects) {
    result[subj.assignmentId] = { ...EMPTY_SUBJECT_TOTALS };
  }

  for (let i = 0; i < pageStudentIds.length; i++) {
    const sid = pageStudentIds[i];
    const row = studentRows[i];
    if (!row) continue;

    for (const subj of subjects) {
      const aid = subj.assignmentId;
      const totals = result[aid];
      const display = (row.grades[aid] ?? "").trim();

      if (!display) {
        totals.noCursantes++;
        continue;
      }

      totals.inscritos++;
      const g = gradeMap.get(`${sid}:${aid}`);
      if (g) {
        totals.inasistentes += g.absence_count ?? 0;
        totals.asistentes += g.attendance_count ?? 0;
      }

      if (subj.evaluationType !== "literal") {
        const num =
          subjectNumericFinal(g) ??
          (() => {
            const parsed = parseFloat(display.replace(",", "."));
            return isNaN(parsed) ? null : parsed;
          })();
        if (num !== null) {
          if (isAprobado(num)) totals.aprobados++;
          else totals.noAprobados++;
        }
      }
    }
  }

  return result;
}
