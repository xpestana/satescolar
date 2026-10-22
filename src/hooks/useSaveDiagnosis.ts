import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DiagnosisSections } from "@/lib/diagnosisSheet";
import { untypedSupabase } from "@/lib/untypedSupabase";
import { studentDiagnosesKey } from "@/hooks/useStudentDiagnoses";
interface SaveDiagnosisInput extends DiagnosisSections {
  studentId: string;
}

/** Saves one student's diagnosis for an assignment (one row per student × assignment). */
export function useSaveDiagnosis(assignmentId: string, schoolId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ studentId, strengths, weaknesses, improvements }: SaveDiagnosisInput) => {
      const { error } = await untypedSupabase.from("student_diagnoses").upsert(
        {
          school_id: schoolId,
          student_id: studentId,
          assignment_id: assignmentId,
          strengths,
          weaknesses,
          improvements,
        },
        { onConflict: "student_id,assignment_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: studentDiagnosesKey(assignmentId) }),
    onError: (e: Error) => toast.error("No se pudo guardar el diagnóstico", { description: e.message }),
  });
}
