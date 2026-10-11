import type { SyncSourceEnrollment, SyncSourceSubject } from "@/lib/grade-certificate-sync";

/**
 * Turns the rows read from the database into what "Sincronizar notas" compares against the
 * certificate: the subjects of each enrolment with their definitiva final.
 */

export interface SourceEnrollmentRow {
  id: string;
  sectionId: string;
  schoolYearId: string;
  gradeLevel: string;
  sectionName: string;
  yearRange: string;
}

export interface SourceSubjectRow {
  name: string;
  display_order: number | null;
  show_in_planilla: boolean | null;
  evaluation_type: string | null;
  subject_type: string | null;
  is_suspended: boolean | null;
}

/** A `subject_teacher_assignments` row; `section_id` is null for groups (GCRP). */
export interface SourceAssignmentRow {
  id: string;
  subject_id: string;
  section_id: string | null;
  school_year_id: string;
  school_subjects: SourceSubjectRow | null;
}

/** A `final_grades` row of the student with `momento = 0`. */
export interface SourceGradeRow {
  assignment_id: string;
  grade_value: string | null;
  adjustment_points: number | null;
}

const GROUP_SUBJECT_TYPE = "gcrp";

/** Same rule as the Resumen Final: suspended or hidden-from-planilla subjects are left out. */
function isPlanillaSubject(subject: SourceSubjectRow | null): subject is SourceSubjectRow {
  return !!subject && !subject.is_suspended && subject.show_in_planilla !== false;
}

function hasGrade(grade: SourceGradeRow | undefined): boolean {
  return String(grade?.grade_value ?? "").trim() !== "";
}

/**
 * @param sectionAssignments assignments of the sections the student was enrolled in.
 * @param groupAssignments assignments the student is linked to through `gcrp_assignment_students`.
 */
export function buildSyncSource(
  enrollments: SourceEnrollmentRow[],
  sectionAssignments: SourceAssignmentRow[],
  groupAssignments: SourceAssignmentRow[],
  grades: SourceGradeRow[],
): SyncSourceEnrollment[] {
  const gradeByAssignment = new Map(grades.map((g) => [g.assignment_id, g]));

  return enrollments.map((enrollment) => {
    const ofSection = sectionAssignments.filter((a) =>
      a.section_id === enrollment.sectionId
      && a.school_year_id === enrollment.schoolYearId
      // A student belongs to a group only through its link, never through the section.
      && a.school_subjects?.subject_type !== GROUP_SUBJECT_TYPE);
    const ofGroups = groupAssignments.filter((a) =>
      a.school_year_id === enrollment.schoolYearId
      && a.school_subjects?.subject_type === GROUP_SUBJECT_TYPE);

    // One entry per subject: when two assignments share it, the one with a definitiva wins.
    const bySubject = new Map<string, SourceAssignmentRow>();
    for (const assignment of [...ofSection, ...ofGroups]) {
      if (!isPlanillaSubject(assignment.school_subjects)) continue;
      const current = bySubject.get(assignment.subject_id);
      if (!current || (!hasGrade(gradeByAssignment.get(current.id)) && hasGrade(gradeByAssignment.get(assignment.id)))) {
        bySubject.set(assignment.subject_id, assignment);
      }
    }

    const subjects = [...bySubject.values()]
      .sort((a, b) =>
        (a.school_subjects!.display_order ?? 999) - (b.school_subjects!.display_order ?? 999)
        || a.school_subjects!.name.localeCompare(b.school_subjects!.name))
      .map((assignment): SyncSourceSubject => {
        const subject = assignment.school_subjects!;
        const grade = gradeByAssignment.get(assignment.id);
        return {
          subjectId: assignment.subject_id,
          name: subject.name,
          subjectType: subject.subject_type || "regular",
          evaluationType: subject.evaluation_type || "numeric",
          gradeValue: hasGrade(grade) ? String(grade!.grade_value) : null,
          adjustmentPoints: grade?.adjustment_points ?? 0,
        };
      });

    return {
      enrollmentId: enrollment.id,
      gradeLevel: enrollment.gradeLevel,
      sectionName: enrollment.sectionName,
      yearRange: enrollment.yearRange,
      subjects,
    };
  });
}
