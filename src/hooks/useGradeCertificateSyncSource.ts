import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { CERTIFICATE_GRADE_LEVELS } from "@/lib/grade-certificate";
import {
  type SourceAssignmentRow,
  type SourceEnrollmentRow,
  type SourceGradeRow,
  buildSyncSource,
} from "@/lib/grade-certificate-sync-source";
import type { SyncSourceEnrollment } from "@/lib/grade-certificate-sync";

const ASSIGNMENT_SELECT =
  "id, subject_id, section_id, school_year_id, "
  + "school_subjects(name, display_order, show_in_planilla, evaluation_type, subject_type, is_suspended)";

interface EnrollmentQueryRow {
  id: string;
  section_id: string;
  school_year_id: string;
  sections: { grade_level: string; name: string };
  school_years: { year_range: string };
}

/**
 * What the system has for a student: their 1er–5to año enrolments with the subjects of each one
 * and the definitiva final (`final_grades`, `momento = 0`).
 */
export async function fetchGradeCertificateSyncSource(
  schoolId: string,
  studentId: string,
): Promise<SyncSourceEnrollment[]> {
  const { data: enrollmentData, error: enrollmentError } = await supabase
    .from("enrollments")
    .select("id, section_id, school_year_id, sections!inner(grade_level, name), school_years!inner(year_range)")
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .in("sections.grade_level", [...CERTIFICATE_GRADE_LEVELS]);
  if (enrollmentError) throw new Error(`Error al cargar las inscripciones: ${enrollmentError.message}`);

  const enrollments: SourceEnrollmentRow[] = ((enrollmentData ?? []) as unknown as EnrollmentQueryRow[]).map((e) => ({
    id: e.id,
    sectionId: e.section_id,
    schoolYearId: e.school_year_id,
    gradeLevel: e.sections.grade_level,
    sectionName: e.sections.name,
    yearRange: e.school_years.year_range,
  }));
  if (enrollments.length === 0) return [];

  const sectionIds = [...new Set(enrollments.map((e) => e.sectionId))];
  const schoolYearIds = [...new Set(enrollments.map((e) => e.schoolYearId))];

  const [sectionResult, linkResult] = await Promise.all([
    supabase
      .from("subject_teacher_assignments")
      .select(ASSIGNMENT_SELECT)
      .eq("school_id", schoolId)
      .in("section_id", sectionIds)
      .in("school_year_id", schoolYearIds)
      .eq("is_suspended", false),
    supabase
      .from("gcrp_assignment_students")
      .select("assignment_id")
      .eq("school_id", schoolId)
      .eq("student_id", studentId),
  ]);
  if (sectionResult.error) throw new Error(`Error al cargar las materias: ${sectionResult.error.message}`);
  if (linkResult.error) throw new Error(`Error al cargar los grupos: ${linkResult.error.message}`);

  const sectionAssignments = (sectionResult.data ?? []) as unknown as SourceAssignmentRow[];
  const groupAssignmentIds = [...new Set((linkResult.data ?? []).map((l) => l.assignment_id))];

  let groupAssignments: SourceAssignmentRow[] = [];
  if (groupAssignmentIds.length > 0) {
    const { data, error } = await supabase
      .from("subject_teacher_assignments")
      .select(ASSIGNMENT_SELECT)
      .in("id", groupAssignmentIds)
      .in("school_year_id", schoolYearIds)
      .eq("is_suspended", false);
    if (error) throw new Error(`Error al cargar los grupos: ${error.message}`);
    groupAssignments = (data ?? []) as unknown as SourceAssignmentRow[];
  }

  const assignmentIds = [...sectionAssignments, ...groupAssignments].map((a) => a.id);
  let grades: SourceGradeRow[] = [];
  if (assignmentIds.length > 0) {
    const { data, error } = await supabase
      .from("final_grades")
      .select("assignment_id, grade_value, adjustment_points")
      .eq("school_id", schoolId)
      .eq("student_id", studentId)
      .eq("momento", 0)
      .in("assignment_id", assignmentIds);
    if (error) throw new Error(`Error al cargar las notas definitivas: ${error.message}`);
    grades = data ?? [];
  }

  return buildSyncSource(enrollments, sectionAssignments, groupAssignments, grades);
}

/** Read fresh each time the sync dialog opens: final grades may have changed since the last look. */
export function useGradeCertificateSyncSource(studentId: string | null, enabled: boolean) {
  const { schoolId } = useSchoolId();

  return useQuery({
    queryKey: ["grade-certificate-sync-source", schoolId, studentId],
    queryFn: () => fetchGradeCertificateSyncSource(schoolId!, studentId!),
    enabled: enabled && !!schoolId && !!studentId,
    staleTime: 0,
    gcTime: 0,
  });
}
