/**
 * Pure helpers for the teacher attendance screen: which assignments are in play
 * (one school year at a time) and how the database summary maps to the UI.
 */

export interface AttendanceScopeAssignment {
  section: { id: string } | null;
  subject: { id: string } | null;
  school_year: { id: string; year_range: string; is_active: boolean } | null;
}

export interface AttendanceScope<T extends AttendanceScopeAssignment> {
  schoolYearId: string | null;
  assignments: T[];
  sectionIds: string[];
  subjectIds: string[];
}

/**
 * Keeps the assignments of a single school year: the active one, or the most
 * recent year (by `year_range`) when none is active. Section and subject ids
 * come out de-duplicated, ready for `.in(...)` filters and stable query keys.
 */
export function getAttendanceScope<T extends AttendanceScopeAssignment>(assignments: T[]): AttendanceScope<T> {
  const withYear = assignments.filter((a) => a.school_year?.id && a.section?.id && a.subject?.id);
  const active = withYear.find((a) => a.school_year!.is_active);
  const latest = [...withYear].sort((a, b) => b.school_year!.year_range.localeCompare(a.school_year!.year_range))[0];
  const schoolYearId = (active ?? latest)?.school_year?.id ?? null;

  const inYear = schoolYearId ? withYear.filter((a) => a.school_year!.id === schoolYearId) : [];
  const unique = (ids: string[]) => Array.from(new Set(ids)).sort();

  return {
    schoolYearId,
    assignments: inYear,
    sectionIds: unique(inYear.map((a) => a.section!.id)),
    subjectIds: unique(inYear.map((a) => a.subject!.id)),
  };
}

export interface AttendanceSummary {
  totalSessions: number;
  totalAbsences: number;
  attendanceRate: number;
  absencesByStudent: Array<{ studentId: string; absences: number; total: number }>;
  absencesByWeek: Array<{ week: string; absences: number; present: number }>;
}

interface RawSummary {
  total?: number | null;
  absences?: number | null;
  by_student?: Array<{ student_id: string; total: number; absences: number }> | null;
  by_week?: Array<{ week_start: string; absences: number; present: number }> | null;
}

/** "2026-11-23" → "23/11" (the Monday that starts the week). */
function weekLabel(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return `${day}/${month}`;
}

/** Maps `get_teacher_attendance_summary` output to what the Resumen tab draws. */
export function mapAttendanceSummary(raw: unknown): AttendanceSummary {
  const data = (raw ?? {}) as RawSummary;
  const total = Number(data.total ?? 0);
  const absences = Number(data.absences ?? 0);
  return {
    totalSessions: total,
    totalAbsences: absences,
    attendanceRate: total > 0 ? Math.round(((total - absences) / total) * 100) : 100,
    absencesByStudent: (data.by_student ?? []).map((s) => ({
      studentId: s.student_id,
      absences: Number(s.absences),
      total: Number(s.total),
    })),
    absencesByWeek: (data.by_week ?? []).map((w) => ({
      week: weekLabel(w.week_start),
      absences: Number(w.absences),
      present: Number(w.present),
    })),
  };
}
