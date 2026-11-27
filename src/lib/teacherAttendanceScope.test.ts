import { describe, expect, it } from "vitest";
import { getAttendanceScope, mapAttendanceSummary } from "./teacherAttendanceScope";

const year = (id: string, year_range: string, is_active: boolean) => ({ id, year_range, is_active });
const assignment = (section: string, subject: string, y: ReturnType<typeof year>) => ({
  section: { id: section },
  subject: { id: subject },
  school_year: y,
});

describe("getAttendanceScope", () => {
  const y25 = year("y25", "2025 - 2026", true);
  const y24 = year("y24", "2024 - 2025", false);

  it("keeps only the active year and de-duplicates sections and subjects", () => {
    const scope = getAttendanceScope([
      assignment("s3", "math", y25),
      assignment("s3", "phys", y25),
      assignment("s1", "first", y25),
      assignment("s3", "math", y24),
    ]);
    expect(scope.schoolYearId).toBe("y25");
    expect(scope.assignments).toHaveLength(3);
    expect(scope.sectionIds).toEqual(["s1", "s3"]);
    expect(scope.subjectIds).toEqual(["first", "math", "phys"]);
  });

  it("falls back to the most recent year when none is active", () => {
    const scope = getAttendanceScope([
      assignment("s3", "math", year("y23", "2023 - 2024", false)),
      assignment("s3", "math", y24),
    ]);
    expect(scope.schoolYearId).toBe("y24");
  });

  it("ignores assignments without section, subject or year", () => {
    const scope = getAttendanceScope([
      { section: null, subject: { id: "x" }, school_year: y25 },
      { section: { id: "s" }, subject: null, school_year: y25 },
      { section: { id: "s" }, subject: { id: "x" }, school_year: null },
    ]);
    expect(scope).toEqual({ schoolYearId: null, assignments: [], sectionIds: [], subjectIds: [] });
  });
});

describe("mapAttendanceSummary", () => {
  it("maps totals, rate, students and week labels", () => {
    const summary = mapAttendanceSummary({
      total: 10,
      absences: 2,
      by_student: [{ student_id: "a", total: 5, absences: 2 }],
      by_week: [{ week_start: "2026-11-23", absences: 2, present: 8 }],
    });
    expect(summary).toEqual({
      totalSessions: 10,
      totalAbsences: 2,
      attendanceRate: 80,
      absencesByStudent: [{ studentId: "a", total: 5, absences: 2 }],
      absencesByWeek: [{ week: "23/11", absences: 2, present: 8 }],
    });
  });

  it("returns an empty summary with 100% when there are no records", () => {
    expect(mapAttendanceSummary(null)).toEqual({
      totalSessions: 0,
      totalAbsences: 0,
      attendanceRate: 100,
      absencesByStudent: [],
      absencesByWeek: [],
    });
  });
});
