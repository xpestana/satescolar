import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { GradesGateReason, isGradesGateReason } from "@/lib/gradesAccess";

/**
 * Asks the database why (or whether) the signed-in representative may see the grades of one of
 * their students for a given school year and momento.
 *
 * The answer is only used to explain the situation on screen: the actual gate is enforced by RLS
 * on every grade table, so a representative who bypasses the UI still reads nothing.
 */
export function useStudentGradesAccess(
  studentId: string | null | undefined,
  schoolYearId: string | null | undefined,
  momento: number,
) {
  const query = useQuery({
    queryKey: ["representative-grades-gate", studentId, schoolYearId, momento],
    queryFn: async (): Promise<GradesGateReason> => {
      const { data, error } = await supabase.rpc("representative_grades_gate", {
        _student_id: studentId!,
        _school_year_id: schoolYearId!,
        _momento: momento,
      });
      if (error) throw error;
      return isGradesGateReason(data) ? data : "not_child";
    },
    enabled: !!studentId && !!schoolYearId,
  });

  return {
    reason: query.data ?? null,
    allowed: query.data === "ok",
    isLoading: query.isLoading,
    error: query.error,
  };
}
