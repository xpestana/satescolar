import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DiagnosisCandidate, pickDiagnosisAssignments } from "@/lib/diagnosisEligibility";
import { teacherDisplayName } from "@/lib/teacherName";

export interface SectionDiagnosisAssignment extends DiagnosisCandidate {
  teacherId: string;
  teacherName: string;
}

interface AssignmentRow {
  id: string;
  section_id: string;
  school_year_id: string;
  teacher_id: string;
  is_main_report: boolean;
  subject: { name: string; display_order: number | null } | null;
  teacher: { form_data: unknown } | null;
}

/**
 * The área carrying the diagnosis of each of these sections, by section × school year
 * (`diagnosisSectionKey`). Shared by the teacher's Mis Áreas, the teacher's diagnosis screen and the
 * school's tab, so all three agree on which área it is.
 */
export function useSectionDiagnosisAssignments(schoolId: string | null | undefined, sectionIds: string[]) {
  const ids = [...new Set(sectionIds)].sort();
  return useQuery({
    queryKey: ["section-diagnosis-assignments", schoolId, ids],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subject_teacher_assignments")
        .select("id, section_id, school_year_id, teacher_id, is_main_report, subject:subject_id(name, display_order), teacher:teacher_id(form_data)")
        .eq("school_id", schoolId!)
        .in("section_id", ids)
        .eq("is_suspended", false);
      if (error) throw error;
      return pickDiagnosisAssignments<SectionDiagnosisAssignment>(
        ((data ?? []) as unknown as AssignmentRow[]).map((row) => ({
          assignmentId: row.id,
          sectionId: row.section_id,
          schoolYearId: row.school_year_id,
          isMainReport: !!row.is_main_report,
          subjectName: row.subject?.name ?? "",
          displayOrder: row.subject?.display_order ?? null,
          teacherId: row.teacher_id,
          teacherName: teacherDisplayName(row.teacher?.form_data),
        })),
      );
    },
    enabled: !!schoolId && ids.length > 0,
  });
}
