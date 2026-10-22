import { useQuery } from "@tanstack/react-query";
import { DiagnosisSections } from "@/lib/diagnosisSheet";
import { untypedSupabase } from "@/lib/untypedSupabase";

export interface StudentDiagnosis extends DiagnosisSections {
  student_id: string;
  updated_at: string;
}

export const studentDiagnosesKey = (assignmentId: string | undefined) => ["student-diagnoses", assignmentId];

/** Diagnoses written for an assignment (docente × área × sección × año), by student id. */
export function useStudentDiagnoses(assignmentId: string | undefined) {
  return useQuery({
    queryKey: studentDiagnosesKey(assignmentId),
    queryFn: async (): Promise<Record<string, StudentDiagnosis>> => {
      const { data, error } = await untypedSupabase
        .from("student_diagnoses")
        .select("student_id, strengths, weaknesses, improvements, updated_at")
        .eq("assignment_id", assignmentId!);
      if (error) throw error;
      const byStudent: Record<string, StudentDiagnosis> = {};
      ((data ?? []) as StudentDiagnosis[]).forEach((row) => {
        byStudent[row.student_id] = row;
      });
      return byStudent;
    },
    enabled: !!assignmentId,
  });
}
