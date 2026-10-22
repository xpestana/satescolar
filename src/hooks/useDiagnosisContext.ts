import { useQuery } from "@tanstack/react-query";
import { loadDiagnosisContext } from "@/lib/diagnosisSheetData";

/** School, year, sections, signatures and logos of an assignment's diagnosis sheets (no text). */
export function useDiagnosisContext(assignmentId: string, studentIds: string[], enabled: boolean) {
  return useQuery({
    queryKey: ["diagnosis-context", assignmentId, studentIds],
    queryFn: () => loadDiagnosisContext(assignmentId, studentIds),
    // Refetched every time the editor opens, so a signature changed meanwhile shows up.
    enabled: enabled && !!assignmentId && studentIds.length > 0,
  });
}
