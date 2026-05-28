import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TeacherAssignment {
  id: string;
  school_id: string;
  school_year_id: string;
  subject: { id: string; name: string; abbreviation: string } | null;
  section: { id: string; name: string; grade_level: string } | null;
  school_year: { id: string; year_range: string; is_active: boolean } | null;
}

export interface EnrolledStudent {
  studentId: string;
  documentId: string | null;
  photoUrl: string | null;
  fullName: string;
  formData: Record<string, unknown>;
}

export interface AttendanceRecord {
  id: string;
  entity_id: string;
  status: string;
  momento: number | null;
  subject_id: string | null;
  section_id: string | null;
  attendance_date: string;
  attendance_time: string;
}

export interface AttendanceBatchItem {
  entity_id: string;
  entity_type: "student";
  school_id: string;
  section_id: string;
  subject_id: string;
  momento: number;
  status: "present" | "absent";
  attendance_date: string;
  attendance_time: string;
  attendance_timestamp: string;
  record_type: "manual";
  notification_sent: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractFullName(formData: Record<string, unknown>): string {
  const parts = [
    formData?.primer_nombre,
    formData?.segundo_nombre,
    formData?.primer_apellido,
    formData?.segundo_apellido,
  ]
    .filter(Boolean)
    .join(" ");
  return parts || "Sin nombre";
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useTeacherAssignments(teacherId: string | undefined) {
  return useQuery({
    queryKey: ["teacher-assignments-attendance", teacherId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subject_teacher_assignments")
        .select(`
          id,
          school_id,
          school_year_id,
          subject:subject_id(id, name, abbreviation),
          section:section_id(id, name, grade_level),
          school_year:school_year_id(id, year_range, is_active)
        `)
        .eq("teacher_id", teacherId!)
        .eq("is_suspended", false)
        .not("section_id", "is", null);
      if (error) throw error;
      return (data ?? []) as TeacherAssignment[];
    },
    enabled: !!teacherId,
  });
}

export function useEnrolledStudents(
  sectionId: string | undefined,
  schoolYearId: string | undefined,
  schoolId: string | undefined
) {
  return useQuery({
    queryKey: ["enrolled-students-attendance", sectionId, schoolYearId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("student_id, student:student_id(id, document_id, form_data, photo_url)")
        .eq("section_id", sectionId!)
        .eq("school_year_id", schoolYearId!)
        .eq("school_id", schoolId!);
      if (error) throw error;

      return ((data ?? []) as Array<{
        student_id: string;
        student: { id: string; document_id: string | null; form_data: Record<string, unknown>; photo_url: string | null } | null;
      }>)
        .filter((e) => e.student)
        .map((e) => ({
          studentId: e.student!.id,
          documentId: e.student!.document_id,
          photoUrl: e.student!.photo_url,
          fullName: extractFullName(e.student!.form_data ?? {}),
          formData: e.student!.form_data ?? {},
        } as EnrolledStudent))
        .sort((a, b) => a.fullName.localeCompare(b.fullName, "es"));
    },
    enabled: !!sectionId && !!schoolYearId && !!schoolId,
  });
}

export function useAttendanceByDate(
  schoolId: string | undefined,
  sectionIds: string[],
  date: Date | undefined
) {
  return useQuery({
    queryKey: ["attendance-by-date", schoolId, sectionIds, date ? format(date, "yyyy-MM-dd") : null],
    queryFn: async () => {
      const dateStr = format(date!, "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("attendance_records")
        .select("id, entity_id, status, momento, subject_id, section_id, attendance_date, attendance_time")
        .eq("school_id", schoolId!)
        .eq("entity_type", "student")
        .eq("record_type", "manual")
        .eq("attendance_date", dateStr)
        .in("section_id", sectionIds);
      if (error) throw error;
      return (data ?? []) as AttendanceRecord[];
    },
    enabled: !!schoolId && sectionIds.length > 0 && !!date,
  });
}

export function useAttendanceDaysWithRecords(
  schoolId: string | undefined,
  sectionIds: string[],
  month: Date
) {
  const monthStart = format(startOfMonth(month), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(month), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["attendance-days-records", schoolId, sectionIds, monthStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("attendance_date")
        .eq("school_id", schoolId!)
        .eq("entity_type", "student")
        .eq("record_type", "manual")
        .gte("attendance_date", monthStart)
        .lte("attendance_date", monthEnd)
        .in("section_id", sectionIds);
      if (error) throw error;
      const unique = new Set((data ?? []).map((r) => r.attendance_date));
      return Array.from(unique).map((d) => new Date(d + "T12:00:00"));
    },
    enabled: !!schoolId && sectionIds.length > 0,
  });
}

export function useSaveAttendanceBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (records: AttendanceBatchItem[]) => {
      const { error } = await supabase
        .from("attendance_records")
        .upsert(records, { onConflict: "entity_id,attendance_date,section_id,subject_id,momento" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance-by-date"] });
      qc.invalidateQueries({ queryKey: ["attendance-days-records"] });
      qc.invalidateQueries({ queryKey: ["attendance-summary"] });
    },
  });
}

export function useUpdateAttendanceRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "present" | "absent" }) => {
      const { error } = await supabase
        .from("attendance_records")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance-by-date"] });
      qc.invalidateQueries({ queryKey: ["attendance-summary"] });
    },
  });
}

export function useBulkUpdateMomento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      sectionId,
      date,
      subjectId,
      momento,
    }: {
      sectionId: string;
      date: string;
      subjectId: string | null;
      momento: number;
    }) => {
      let query = supabase
        .from("attendance_records")
        .update({ momento })
        .eq("section_id", sectionId)
        .eq("attendance_date", date)
        .eq("record_type", "manual");

      if (subjectId) query = query.eq("subject_id", subjectId);

      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance-by-date"] });
      qc.invalidateQueries({ queryKey: ["attendance-summary"] });
    },
  });
}

export interface AttendanceSummary {
  totalSessions: number;
  totalAbsences: number;
  attendanceRate: number;
  absencesByStudent: Array<{ studentId: string; fullName: string; absences: number; total: number }>;
  absencesByWeek: Array<{ week: string; absences: number; present: number }>;
}

export function useAttendanceSummary(
  schoolId: string | undefined,
  sectionIds: string[]
) {
  return useQuery({
    queryKey: ["attendance-summary", schoolId, sectionIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("entity_id, status, attendance_date, section_id")
        .eq("school_id", schoolId!)
        .eq("entity_type", "student")
        .eq("record_type", "manual")
        .in("section_id", sectionIds);
      if (error) throw error;

      const records = data ?? [];
      const total = records.length;
      const absences = records.filter((r) => r.status === "absent").length;

      // Per student aggregation (entity_id only — names resolved at render time)
      const byStudent = new Map<string, { absences: number; total: number }>();
      for (const r of records) {
        const cur = byStudent.get(r.entity_id) ?? { absences: 0, total: 0 };
        cur.total++;
        if (r.status === "absent") cur.absences++;
        byStudent.set(r.entity_id, cur);
      }

      // Per week aggregation (last 8 weeks)
      const byWeek = new Map<string, { absences: number; present: number }>();
      for (const r of records) {
        const d = new Date(r.attendance_date + "T12:00:00");
        const monday = new Date(d);
        monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        const key = format(monday, "dd/MM");
        const cur = byWeek.get(key) ?? { absences: 0, present: 0 };
        if (r.status === "absent") cur.absences++;
        else cur.present++;
        byWeek.set(key, cur);
      }

      return {
        totalSessions: total,
        totalAbsences: absences,
        attendanceRate: total > 0 ? Math.round(((total - absences) / total) * 100) : 100,
        absencesByStudent: Array.from(byStudent.entries()).map(([studentId, v]) => ({
          studentId,
          fullName: studentId,
          ...v,
        })),
        absencesByWeek: Array.from(byWeek.entries())
          .slice(-8)
          .map(([week, v]) => ({ week, ...v })),
      } as AttendanceSummary;
    },
    enabled: !!schoolId && sectionIds.length > 0,
  });
}

export function useStudentAttendanceHistory(
  schoolId: string | undefined,
  studentId: string | undefined,
  sectionIds: string[]
) {
  return useQuery({
    queryKey: ["student-attendance-history", schoolId, studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("id, attendance_date, status, momento, subject_id, section_id")
        .eq("school_id", schoolId!)
        .eq("entity_id", studentId!)
        .eq("record_type", "manual")
        .in("section_id", sectionIds)
        .order("attendance_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!schoolId && !!studentId && sectionIds.length > 0,
  });
}
