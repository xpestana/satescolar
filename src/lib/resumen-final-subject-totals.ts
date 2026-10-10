import type { StudentDocxRow, SubjectCol, SubjectAreaTotals } from "@/hooks/useResumenFinalDocxData";

export type SubjectGradeRecord = {
  student_id: string;
  assignment_id: string;
  grade_value: string | null;
  adjustment_points: number;
  final_status: string | null;
  /** Marcado Inasistente en la Definitiva Final; false/ausente = Asistente (por defecto). */
  is_final_absentee?: boolean | null;
};

const EMPTY_SUBJECT_TOTALS: SubjectAreaTotals = {
  inscritos: 0,
  inasistentes: 0,
  asistentes: 0,
  aprobados: 0,
  noAprobados: 0,
  noCursantes: 0,
};

/**
 * Asistentes e Inasistentes son cantidades de estudiantes: cada inscrito cuenta como Asistente
 * salvo que el colegio lo marque Inasistente en la Definitiva Final (`is_final_absentee`). Un
 * marcado Inasistente cuenta como inscrito aunque no tenga nota. Así Inscritos = Asistentes +
 * Inasistentes.
 *
 * Estado final de la materia que el colegio marca en la Definitiva Final (`final_grades.final_status`,
 * momento 0). Aprobados y No Aprobados se cuentan con él, no con la nota. Sin estado = no se cuenta.
 */
const STATUS_APROBADO = "aprobado";
const STATUS_NO_APROBADO = "no_aprobado";

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
      const g = gradeMap.get(`${sid}:${aid}`);
      const isAbsentee = g?.is_final_absentee === true;

      if (!display && !isAbsentee) {
        totals.noCursantes++;
        continue;
      }

      totals.inscritos++;
      if (isAbsentee) totals.inasistentes++;
      else totals.asistentes++;

      const status = (g?.final_status ?? "").trim();
      if (status === STATUS_APROBADO) totals.aprobados++;
      else if (status === STATUS_NO_APROBADO) totals.noAprobados++;
    }
  }

  return result;
}
