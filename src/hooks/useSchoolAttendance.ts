import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, startOfMonth } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AttendancePeriod = "today" | "week" | "month" | "custom";

export interface SchoolAttendanceSummary {
  totalRecords: number;
  totalPresent: number;
  totalAbsent: number;
  attendanceRate: number;
}

export interface AttendanceTrendPoint {
  date: string;
  present: number;
  absent: number;
}

export interface AttendanceBySectionPoint {
  section: string;
  present: number;
  absent: number;
  rate: number;
}

export interface AttendanceBySubjectPoint {
  subject: string;
  absent: number;
  present: number;
}

export interface TopAbsentee {
  studentId: string;
  fullName: string;
  absences: number;
  total: number;
  rate: number;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function getDateRange(period: AttendancePeriod, customFrom?: string, customTo?: string) {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  switch (period) {
    case "today":
      return { dateFrom: todayStr, dateTo: todayStr };
    case "week": {
      const monday = startOfWeek(today, { weekStartsOn: 1 });
      return { dateFrom: format(monday, "yyyy-MM-dd"), dateTo: todayStr };
    }
    case "month": {
      const first = startOfMonth(today);
      return { dateFrom: format(first, "yyyy-MM-dd"), dateTo: todayStr };
    }
    case "custom":
      return {
        dateFrom: customFrom ?? todayStr,
        dateTo: customTo ?? todayStr,
      };
  }
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useSchoolAttendanceSummary(
  schoolId: string | undefined,
  dateFrom: string,
  dateTo: string
) {
  return useQuery({
    queryKey: ["school-attendance-summary", schoolId, dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("status")
        .eq("school_id", schoolId!)
        .eq("entity_type", "student")
        .gte("attendance_date", dateFrom)
        .lte("attendance_date", dateTo);
      if (error) throw error;

      const records = data ?? [];
      const total = records.length;
      const present = records.filter((r) => r.status === "present").length;
      const absent = total - present;

      return {
        totalRecords: total,
        totalPresent: present,
        totalAbsent: absent,
        attendanceRate: total > 0 ? Math.round((present / total) * 100) : 0,
      } as SchoolAttendanceSummary;
    },
    enabled: !!schoolId,
  });
}

export function useAttendanceTrend(
  schoolId: string | undefined,
  dateFrom: string,
  dateTo: string
) {
  return useQuery({
    queryKey: ["school-attendance-trend", schoolId, dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("attendance_date, status")
        .eq("school_id", schoolId!)
        .eq("entity_type", "student")
        .gte("attendance_date", dateFrom)
        .lte("attendance_date", dateTo)
        .order("attendance_date", { ascending: true });
      if (error) throw error;

      const byDay = new Map<string, { present: number; absent: number }>();
      for (const r of data ?? []) {
        const cur = byDay.get(r.attendance_date) ?? { present: 0, absent: 0 };
        if (r.status === "present") cur.present++;
        else cur.absent++;
        byDay.set(r.attendance_date, cur);
      }

      return Array.from(byDay.entries()).map(([date, v]) => ({
        date: format(new Date(date + "T12:00:00"), "dd/MM"),
        ...v,
      })) as AttendanceTrendPoint[];
    },
    enabled: !!schoolId,
  });
}

export function useAttendanceBySection(
  schoolId: string | undefined,
  dateFrom: string,
  dateTo: string
) {
  return useQuery({
    queryKey: ["school-attendance-by-section", schoolId, dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("section_id, subject_id, status")
        .eq("school_id", schoolId!)
        .eq("entity_type", "student")
        .gte("attendance_date", dateFrom)
        .lte("attendance_date", dateTo)
        .not("section_id", "is", null);
      if (error) throw error;

      const records = data ?? [];
      const sectionIds = [...new Set(records.map((r) => r.section_id).filter(Boolean))] as string[];
      const subjectIds = [...new Set(records.map((r) => r.subject_id).filter(Boolean))] as string[];
      if (sectionIds.length === 0) return [] as AttendanceBySectionPoint[];

      const [{ data: sections }, { data: subjects }] = await Promise.all([
        supabase.from("sections").select("id, name, grade_level").in("id", sectionIds),
        subjectIds.length > 0
          ? supabase.from("school_subjects").select("id, name, abbreviation").in("id", subjectIds)
          : Promise.resolve({ data: [] }),
      ]);

      const GRADE_LABELS: Record<string, string> = {
        pre_maternal: "Pre-Maternal", maternal: "Maternal", inicial: "Inicial",
        primaria: "Primaria", media_general: "Media General", media_tecnica: "Media Técnica",
        i_nivel: "I Nivel", ii_nivel: "II Nivel", iii_nivel: "III Nivel",
        "1_grado": "1° Grado", "2_grado": "2° Grado", "3_grado": "3° Grado",
        "4_grado": "4° Grado", "5_grado": "5° Grado", "6_grado": "6° Grado",
        "1_ano": "1° Año", "2_ano": "2° Año", "3_ano": "3° Año",
        "4_ano": "4° Año", "5_ano": "5° Año", "6_ano": "6° Año",
      };
      const sectionMap = new Map<string, string>(
        (sections ?? []).map((s) => {
          const grade = GRADE_LABELS[s.grade_level] ?? s.grade_level;
          return [s.id, `${grade} - ${s.name}`];
        })
      );
      const subjectMap = new Map<string, string>(
        (subjects ?? []).map((s) => [s.id, s.abbreviation || s.name])
      );

      // Group by section+subject combination
      const byKey = new Map<string, { label: string; present: number; absent: number }>();
      for (const r of records) {
        if (!r.section_id) continue;
        const sectionLabel = sectionMap.get(r.section_id) ?? r.section_id;
        const subjectLabel = r.subject_id ? subjectMap.get(r.subject_id) : null;
        const label = subjectLabel ? `${subjectLabel} · ${sectionLabel}` : sectionLabel;
        const key = `${r.subject_id ?? ""}|${r.section_id}`;
        const cur = byKey.get(key) ?? { label, present: 0, absent: 0 };
        if (r.status === "present") cur.present++;
        else cur.absent++;
        byKey.set(key, cur);
      }

      return Array.from(byKey.values())
        .map((v) => ({
          section: v.label,
          present: v.present,
          absent: v.absent,
          rate: v.present + v.absent > 0
            ? Math.round((v.present / (v.present + v.absent)) * 100)
            : 0,
        }))
        .sort((a, b) => a.rate - b.rate) as AttendanceBySectionPoint[];
    },
    enabled: !!schoolId,
  });
}

export function useAttendanceBySubject(
  schoolId: string | undefined,
  dateFrom: string,
  dateTo: string
) {
  return useQuery({
    queryKey: ["school-attendance-by-subject", schoolId, dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("subject_id, status")
        .eq("school_id", schoolId!)
        .eq("entity_type", "student")
        .gte("attendance_date", dateFrom)
        .lte("attendance_date", dateTo)
        .not("subject_id", "is", null);
      if (error) throw error;

      const records = data ?? [];
      const subjectIds = [...new Set(records.map((r) => r.subject_id).filter(Boolean))] as string[];
      if (subjectIds.length === 0) return [] as AttendanceBySubjectPoint[];

      const { data: subjects } = await supabase
        .from("school_subjects")
        .select("id, name, abbreviation")
        .in("id", subjectIds);

      const nameMap = new Map<string, string>(
        (subjects ?? []).map((s) => [s.id, s.abbreviation || s.name])
      );

      const bySubject = new Map<string, { present: number; absent: number }>();
      for (const r of records) {
        if (!r.subject_id) continue;
        const cur = bySubject.get(r.subject_id) ?? { present: 0, absent: 0 };
        if (r.status === "present") cur.present++;
        else cur.absent++;
        bySubject.set(r.subject_id, cur);
      }

      return Array.from(bySubject.entries())
        .map(([id, v]) => ({
          subject: nameMap.get(id) ?? id,
          ...v,
        }))
        .sort((a, b) => b.absent - a.absent) as AttendanceBySubjectPoint[];
    },
    enabled: !!schoolId,
  });
}

export function useTopAbsentees(
  schoolId: string | undefined,
  dateFrom: string,
  dateTo: string,
  limit = 10
) {
  return useQuery({
    queryKey: ["school-top-absentees", schoolId, dateFrom, dateTo, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("entity_id, status")
        .eq("school_id", schoolId!)
        .eq("entity_type", "student")
        .gte("attendance_date", dateFrom)
        .lte("attendance_date", dateTo);
      if (error) throw error;

      const records = data ?? [];
      const byStudent = new Map<string, { absences: number; total: number }>();
      for (const r of records) {
        const cur = byStudent.get(r.entity_id) ?? { absences: 0, total: 0 };
        cur.total++;
        if (r.status === "absent") cur.absences++;
        byStudent.set(r.entity_id, cur);
      }

      const sorted = Array.from(byStudent.entries())
        .filter(([, v]) => v.absences > 0)
        .sort((a, b) => b[1].absences - a[1].absences)
        .slice(0, limit);

      if (sorted.length === 0) return [] as TopAbsentee[];

      const studentIds = sorted.map(([id]) => id);
      const { data: students } = await supabase
        .from("students")
        .select("id, form_data")
        .in("id", studentIds);

      const nameMap = new Map<string, string>();
      for (const s of students ?? []) {
        const fd = (s.form_data ?? {}) as Record<string, unknown>;
        const name = [fd.primer_nombre, fd.segundo_nombre, fd.primer_apellido, fd.segundo_apellido]
          .filter(Boolean)
          .join(" ");
        nameMap.set(s.id, name || "Sin nombre");
      }

      return sorted.map(([studentId, v]) => ({
        studentId,
        fullName: nameMap.get(studentId) ?? "Estudiante",
        absences: v.absences,
        total: v.total,
        rate: Math.round((v.absences / v.total) * 100),
      })) as TopAbsentee[];
    },
    enabled: !!schoolId,
  });
}
