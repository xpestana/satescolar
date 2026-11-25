import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toChoiceFields } from "@/lib/enrollmentStats/choiceFields";
import type { AnswerRow, DemographicsRow } from "@/lib/enrollmentStats/enrollmentStatsTypes";

/** Aggregates are cheap but not free: keep them while the user plays with grade/section filters. */
const STATS_STALE_TIME = 60_000;

/** Enrolled students of a school year grouped by section × age × sex × document (server side). */
export function useEnrollmentDemographics(schoolId: string | null | undefined, schoolYearId: string) {
  return useQuery({
    queryKey: ["enrollment-demographics", schoolId, schoolYearId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_enrollment_demographics", {
        p_school_id: schoolId!,
        p_school_year_id: schoolYearId,
      });
      if (error) throw error;
      return (data ?? []) as DemographicsRow[];
    },
    enabled: !!schoolId && !!schoolYearId,
    staleTime: STATS_STALE_TIME,
  });
}

/** Answers of every select/checkbox student field, grouped by section × sex (server side). */
export function useEnrollmentAnswerBreakdown(schoolId: string | null | undefined, schoolYearId: string) {
  return useQuery({
    queryKey: ["enrollment-answer-breakdown", schoolId, schoolYearId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_enrollment_answer_breakdown", {
        p_school_id: schoolId!,
        p_school_year_id: schoolYearId,
      });
      if (error) throw error;
      return (data ?? []) as AnswerRow[];
    },
    enabled: !!schoolId && !!schoolYearId,
    staleTime: STATS_STALE_TIME,
  });
}

/** Student form fields whose answers can be counted, in form order. */
export function useStudentChoiceFields(schoolId: string | null | undefined) {
  return useQuery({
    queryKey: ["student-choice-fields", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("form_fields")
        .select("field_name, field_label, field_type, options")
        .eq("school_id", schoolId!)
        .eq("form_type", "student")
        .eq("is_visible", true)
        .in("field_type", ["select", "checkbox"])
        .order("field_order");
      if (error) throw error;
      return toChoiceFields(data ?? []);
    },
    enabled: !!schoolId,
  });
}
