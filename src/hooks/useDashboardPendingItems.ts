import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buildPendingItems, type PendingCounts } from "@/lib/dashboardPendingItems";

function throwOnError(result: { error: { message: string } | null }) {
  if (result.error) throw new Error(result.error.message);
}

async function countRows(table: "sections" | "family_schools", schoolId: string): Promise<number> {
  const result = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId);
  throwOnError(result);
  return result.count ?? 0;
}

async function countStudentsNotEnrolled(schoolId: string, schoolYearId: string): Promise<number> {
  const [studentSchools, enrollments] = await Promise.all([
    supabase
      .from("student_schools")
      .select("student_id, students!inner(status)")
      .eq("school_id", schoolId)
      .eq("students.status", "active"),
    supabase
      .from("enrollments")
      .select("student_id")
      .eq("school_id", schoolId)
      .eq("school_year_id", schoolYearId),
  ]);
  throwOnError(studentSchools);
  throwOnError(enrollments);

  const enrolledIds = new Set((enrollments.data ?? []).map((e) => e.student_id));
  return (studentSchools.data ?? []).filter((s) => !enrolledIds.has(s.student_id)).length;
}

async function countTeachingGaps(schoolId: string, schoolYearId: string) {
  const [teachers, subjects, assignments] = await Promise.all([
    supabase.from("teachers").select("id").eq("school_id", schoolId).eq("is_suspended", false),
    supabase.from("school_subjects").select("id").eq("school_id", schoolId).eq("is_suspended", false),
    supabase
      .from("subject_teacher_assignments")
      .select("teacher_id, subject_id")
      .eq("school_id", schoolId)
      .eq("school_year_id", schoolYearId)
      .eq("is_suspended", false),
  ]);
  throwOnError(teachers);
  throwOnError(subjects);
  throwOnError(assignments);

  const assignedTeacherIds = new Set((assignments.data ?? []).map((a) => a.teacher_id));
  const assignedSubjectIds = new Set((assignments.data ?? []).map((a) => a.subject_id));
  return {
    teachersWithoutAssignments: (teachers.data ?? []).filter((t) => !assignedTeacherIds.has(t.id)).length,
    subjectsWithoutTeacher: (subjects.data ?? []).filter((s) => !assignedSubjectIds.has(s.id)).length,
  };
}

async function fetchPendingCounts(
  schoolId: string,
  activeSchoolYearId: string | null,
  includeTeaching: boolean,
): Promise<PendingCounts> {
  const [sections, families, studentsNotEnrolled, teachingGaps] = await Promise.all([
    countRows("sections", schoolId),
    countRows("family_schools", schoolId),
    activeSchoolYearId ? countStudentsNotEnrolled(schoolId, activeSchoolYearId) : null,
    activeSchoolYearId && includeTeaching ? countTeachingGaps(schoolId, activeSchoolYearId) : null,
  ]);

  return {
    hasActiveSchoolYear: !!activeSchoolYearId,
    sections,
    families,
    studentsNotEnrolled,
    teachersWithoutAssignments: teachingGaps?.teachersWithoutAssignments ?? null,
    subjectsWithoutTeacher: teachingGaps?.subjectsWithoutTeacher ?? null,
  };
}

/** Pending setup and academic gaps shown on the school dashboard. */
export function useDashboardPendingItems(
  schoolId: string | null,
  activeSchoolYearId: string | null,
  includeTeaching: boolean,
) {
  return useQuery({
    queryKey: ["dashboard-pending", schoolId, activeSchoolYearId, includeTeaching],
    queryFn: async () => {
      const counts = await fetchPendingCounts(schoolId!, activeSchoolYearId, includeTeaching);
      return buildPendingItems(counts, includeTeaching);
    },
    enabled: !!schoolId,
  });
}
