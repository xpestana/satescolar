import { useQuery } from "@tanstack/react-query";
import { untypedSupabase } from "@/lib/untypedSupabase";
import { DiagnosisArea, orderDiagnosisAreas } from "@/lib/diagnosisAreas";
import { teacherDisplayName } from "@/lib/teacherName";

interface AssignmentRow {
  id: string;
  teacher_id: string;
  is_main_report: boolean | null;
  subject: { name: string; display_order: number | null } | null;
  teacher: { form_data: unknown } | null;
}

/** Áreas assigned to a section in a school year, main one first. */
export function useSectionDiagnosisAreas(schoolId: string | null | undefined, schoolYearId: string, sectionId: string) {
  return useQuery({
    queryKey: ["section-diagnosis-areas", schoolId, schoolYearId, sectionId],
    queryFn: async (): Promise<DiagnosisArea[]> => {
      // `is_main_report` is not in the generated types yet.
      const { data, error } = await untypedSupabase
        .from("subject_teacher_assignments")
        .select("id, teacher_id, is_main_report, subject:subject_id(name, display_order), teacher:teacher_id(form_data)")
        .eq("school_id", schoolId!)
        .eq("school_year_id", schoolYearId)
        .eq("section_id", sectionId)
        .eq("is_suspended", false);
      if (error) throw error;
      return orderDiagnosisAreas(
        ((data ?? []) as unknown as AssignmentRow[]).map((row) => ({
          assignmentId: row.id,
          teacherId: row.teacher_id,
          subjectName: row.subject?.name ?? "Área",
          teacherName: teacherDisplayName(row.teacher?.form_data),
          isMain: !!row.is_main_report,
          displayOrder: row.subject?.display_order ?? null,
        })),
      );
    },
    enabled: !!schoolId && !!schoolYearId && !!sectionId,
  });
}
