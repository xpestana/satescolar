import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PersonFormData, studentFullName, studentListName } from "@/lib/studentName";

/**
 * Students of a grades screen (school consultation, final grades and the teacher's grade sheet):
 * the section's enrolments, or the students picked for a GCRP assignment (which has no section).
 */

export interface GradeStudent {
  student_id: string;
  /** "Apellidos Nombres" with both names and surnames — tables and the alphabetical order. */
  student_name: string;
  /** "Nombres Apellidos" with both names and surnames — what the report cards print. */
  full_name: string;
  document_id: string | null;
}

interface GradeStudentsParams {
  assignmentIds: string[];
  isGcrp: boolean;
  sectionId?: string;
  schoolYearId?: string;
  schoolId?: string | null;
}

interface StudentLinkRow {
  student_id: string;
  student: { document_id: string | null; form_data: PersonFormData } | null;
}

const STUDENT_SELECT = "student_id, student:student_id(document_id, form_data)";

export function useGradeStudents({ assignmentIds, isGcrp, sectionId, schoolYearId, schoolId }: GradeStudentsParams) {
  return useQuery({
    queryKey: ["grade-students", isGcrp, assignmentIds, sectionId, schoolYearId, schoolId],
    queryFn: async (): Promise<GradeStudent[]> => {
      const { data, error } = isGcrp
        ? await supabase
            .from("gcrp_assignment_students")
            .select(STUDENT_SELECT)
            .in("assignment_id", assignmentIds)
        : await supabase
            .from("enrollments")
            .select(STUDENT_SELECT)
            .eq("section_id", sectionId!)
            .eq("school_year_id", schoolYearId!)
            .eq("school_id", schoolId!);
      if (error) throw error;

      return ((data ?? []) as unknown as StudentLinkRow[])
        .map((row) => ({
          student_id: row.student_id,
          student_name: studentListName(row.student?.form_data),
          full_name: studentFullName(row.student?.form_data),
          document_id: row.student?.document_id ?? null,
        }))
        .sort((a, b) => a.student_name.localeCompare(b.student_name));
    },
    enabled: isGcrp ? assignmentIds.length > 0 : !!sectionId && !!schoolYearId && !!schoolId,
  });
}
