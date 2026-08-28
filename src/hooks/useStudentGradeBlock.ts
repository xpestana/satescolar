import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Per student switch that blocks the representative's access to grades and report cards.
 *
 * It lives in `student_grade_access` instead of a column on `students` because representatives
 * hold an unrestricted UPDATE policy on `students` and could otherwise clear their own block.
 */

export interface StudentGradeAccessRow {
  student_id: string;
  school_id: string;
  is_blocked: boolean;
  reason: string | null;
  updated_at: string;
}

export function useStudentGradeBlock(schoolId: string | null | undefined, studentIds: string[]) {
  const queryClient = useQueryClient();
  // Sorted so the key does not change when the caller re-orders the same students.
  const idsKey = [...studentIds].sort().join(",");
  const queryKey = ["student-grade-access", schoolId, idsKey];

  const { data: rows = [], isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<StudentGradeAccessRow[]> => {
      const { data, error } = await supabase
        .from("student_grade_access")
        .select("*")
        .eq("school_id", schoolId!)
        .in("student_id", studentIds);
      if (error) throw error;
      return (data ?? []) as StudentGradeAccessRow[];
    },
    enabled: !!schoolId && studentIds.length > 0,
  });

  const isBlocked = (studentId: string) =>
    rows.find((r) => r.student_id === studentId)?.is_blocked ?? false;

  const blockedCount = rows.filter((r) => r.is_blocked).length;

  const setBlocked = useMutation({
    mutationFn: async ({ studentId, blocked }: { studentId: string; blocked: boolean }) => {
      const { error } = await supabase
        .from("student_grade_access")
        .upsert(
          {
            student_id: studentId,
            school_id: schoolId,
            is_blocked: blocked,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "student_id" },
        );
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["student-grade-access"] });
      toast.success(
        variables.blocked
          ? "Acceso a notas y boletas bloqueado"
          : "Acceso a notas y boletas restablecido",
      );
    },
    onError: () => toast.error("No se pudo actualizar el acceso"),
  });

  return { rows, isBlocked, blockedCount, setBlocked, isLoading };
}
