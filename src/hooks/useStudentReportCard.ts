import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { GradeLevelKind, resolveGradeLevelKind } from "@/lib/gradeLevels";

/**
 * Everything the representative report-card screen needs for one student / school year:
 * the enrolment (section and grade level), the subjects of that section and the grades already
 * published for them.
 *
 * Rows hidden by the school, blocked or withheld because of an overdue balance simply do not come
 * back: the filtering happens in RLS (`representative_can_view_grades`), not here.
 */

export const MOMENTO_DEFINITIVA = 0;
export const MOMENTOS = [1, 2, 3] as const;

export interface ReportCardSubject {
  assignmentId: string;
  teacherId: string | null;
  isMainReport: boolean;
  name: string;
  displayOrder: number;
  evaluationType: string | null;
}

export interface SecondaryGradeRow {
  assignmentId: string;
  momento: number;
  gradeValue: string | null;
  adjustmentPoints: number;
  absenceCount: number;
  finalStatus: string | null;
  observation: string | null;
}

export interface QualitativeReportRow {
  assignmentId: string;
  momento: number;
  descriptiveReport: string | null;
  literal: string | null;
  literalNumerico: number | null;
  absenceCount: number;
  attendanceCount: number;
  finalStatus: string | null;
}

export interface StudentReportCard {
  sectionId: string | null;
  sectionName: string | null;
  gradeLevel: string | null;
  levelKind: GradeLevelKind;
  subjects: ReportCardSubject[];
  secondaryGrades: SecondaryGradeRow[];
  qualitativeReports: QualitativeReportRow[];
  /** Momentos (0 = Definitiva Final) that actually returned data for this student. */
  publishedMomentos: number[];
}

interface AssignmentRow {
  id: string;
  teacher_id: string | null;
  is_main_report: boolean | null;
  subject: {
    name: string | null;
    display_order: number | null;
    evaluation_type: string | null;
    show_in_report_card: boolean | null;
  } | null;
}

interface FinalGradeRow {
  assignment_id: string;
  momento: number;
  grade_value: string | null;
  adjustment_points: number | null;
  absence_count: number | null;
  final_status: string | null;
  observation: string | null;
}

interface QualitativeRow {
  assignment_id: string;
  momento: number;
  descriptive_report: string | null;
  literal: string | null;
  literal_numerico?: number | null;
  absence_count: number | null;
  attendance_count: number | null;
  final_status: string | null;
}

const EMPTY: StudentReportCard = {
  sectionId: null,
  sectionName: null,
  gradeLevel: null,
  levelKind: "unknown",
  subjects: [],
  secondaryGrades: [],
  qualitativeReports: [],
  publishedMomentos: [],
};

interface UseStudentReportCardParams {
  studentId: string | null | undefined;
  schoolId: string | null | undefined;
  schoolYearId: string | null | undefined;
}

export function useStudentReportCard({ studentId, schoolId, schoolYearId }: UseStudentReportCardParams) {
  return useQuery({
    queryKey: ["student-report-card", studentId, schoolId, schoolYearId],
    queryFn: async (): Promise<StudentReportCard> => {
      const { data: enrollment, error: enrollmentError } = await supabase
        .from("enrollments")
        .select("section_id, sections:section_id(id, name, grade_level)")
        .eq("student_id", studentId!)
        .eq("school_year_id", schoolYearId!)
        // A section change mid-year leaves two rows; the latest one is the one that counts.
        .order("enrolled_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (enrollmentError) throw enrollmentError;

      const section = enrollment?.sections as { id: string; name: string; grade_level: string } | null;
      if (!enrollment || !section) return EMPTY;

      const levelKind = resolveGradeLevelKind(section.grade_level);
      const base = {
        sectionId: section.id,
        sectionName: section.name,
        gradeLevel: section.grade_level,
        levelKind,
      };

      const { data: assignmentData, error: assignmentsError } = await supabase
        .from("subject_teacher_assignments")
        .select("id, teacher_id, is_main_report, subject:subject_id(name, display_order, evaluation_type, show_in_report_card)")
        .eq("school_id", schoolId!)
        .eq("section_id", section.id)
        .eq("school_year_id", schoolYearId!)
        .eq("is_suspended", false);
      if (assignmentsError) throw assignmentsError;

      const assignments = (assignmentData ?? []) as unknown as AssignmentRow[];

      const subjects: ReportCardSubject[] = assignments
        .filter((a) => a.subject?.show_in_report_card !== false)
        .map((a) => ({
          assignmentId: a.id,
          teacherId: a.teacher_id ?? null,
          isMainReport: !!a.is_main_report,
          name: a.subject?.name ?? "—",
          displayOrder: a.subject?.display_order ?? 0,
          evaluationType: a.subject?.evaluation_type ?? null,
        }))
        .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));

      const assignmentIds = assignments.map((a) => a.id);
      if (assignmentIds.length === 0) return { ...EMPTY, ...base };

      let secondaryGrades: SecondaryGradeRow[] = [];
      let qualitativeReports: QualitativeReportRow[] = [];

      if (levelKind === "secondary" || levelKind === "unknown") {
        const { data, error } = await supabase
          .from("final_grades")
          .select("assignment_id, momento, grade_value, adjustment_points, absence_count, final_status, observation")
          .eq("student_id", studentId!)
          .in("assignment_id", assignmentIds);
        if (error) throw error;
        secondaryGrades = ((data ?? []) as unknown as FinalGradeRow[]).map((r) => ({
          assignmentId: r.assignment_id,
          momento: r.momento,
          gradeValue: r.grade_value,
          adjustmentPoints: Number(r.adjustment_points ?? 0),
          absenceCount: Number(r.absence_count ?? 0),
          finalStatus: r.final_status,
          observation: r.observation,
        }));
      } else {
        const isPrimary = levelKind === "primary";
        const table = isPrimary ? "primary_final_reports" : "preschool_final_reports";
        const columns = isPrimary
          ? "assignment_id, momento, descriptive_report, literal, literal_numerico, absence_count, attendance_count, final_status"
          : "assignment_id, momento, descriptive_report, literal, absence_count, attendance_count, final_status";
        // The table name is resolved at runtime, which the generated Supabase types cannot narrow.
        const { data, error } = await supabase
          .from(table as "primary_final_reports")
          .select(columns)
          .eq("student_id", studentId!)
          .in("assignment_id", assignmentIds);
        if (error) throw error;
        qualitativeReports = ((data ?? []) as unknown as QualitativeRow[]).map((r) => ({
          assignmentId: r.assignment_id,
          momento: r.momento,
          descriptiveReport: r.descriptive_report ?? null,
          literal: r.literal ?? null,
          literalNumerico: r.literal_numerico ?? null,
          absenceCount: Number(r.absence_count ?? 0),
          attendanceCount: Number(r.attendance_count ?? 0),
          finalStatus: r.final_status ?? null,
        }));
      }

      const publishedMomentos = Array.from(
        new Set([
          ...secondaryGrades.map((g) => g.momento),
          ...qualitativeReports.map((r) => r.momento),
        ]),
      ).sort((a, b) => a - b);

      return { ...base, subjects, secondaryGrades, qualitativeReports, publishedMomentos };
    },
    enabled: !!studentId && !!schoolId && !!schoolYearId,
  });
}
