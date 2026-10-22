import { useQuery } from "@tanstack/react-query";
import { loadDiagnosisContext } from "@/lib/diagnosisSheetData";

/** School, year, section, signatures and logos of an assignment's diagnosis sheets. */
export function useDiagnosisContext(assignmentId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["diagnosis-context", assignmentId],
    queryFn: () => loadDiagnosisContext(assignmentId),
    // Refetched every time the editor opens, so a signature changed meanwhile shows up.
    enabled: enabled && !!assignmentId,
  });
}
