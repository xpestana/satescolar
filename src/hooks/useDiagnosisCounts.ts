import { useQuery } from "@tanstack/react-query";
import { untypedSupabase } from "@/lib/untypedSupabase";

export const DIAGNOSIS_COUNTS_KEY = "diagnosis-counts";

/** How many diagnoses each assignment has. Only the assignment_id column travels. */
export function useDiagnosisCounts(assignmentIds: string[]) {
  return useQuery({
    queryKey: [DIAGNOSIS_COUNTS_KEY, assignmentIds],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await untypedSupabase
        .from("student_diagnoses")
        .select("assignment_id")
        .in("assignment_id", assignmentIds);
      if (error) throw error;
      const counts: Record<string, number> = {};
      ((data ?? []) as { assignment_id: string }[]).forEach((row) => {
        counts[row.assignment_id] = (counts[row.assignment_id] ?? 0) + 1;
      });
      return counts;
    },
    enabled: assignmentIds.length > 0,
  });
}
