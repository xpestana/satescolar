import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SchoolYearOption {
  id: string;
  year_range: string;
  is_active: boolean;
  [key: string]: any;
}

/**
 * School years of a school plus the currently selected one.
 *
 * Payment screens used to be pinned to the year with `is_active = true`, which made it
 * impossible to charge (or audit) a different year. Balances, assigned plans and payments are
 * all scoped by `school_year_id`, so each year keeps its own books and any of them can be
 * selected safely.
 *
 * The selection starts on the active year, falling back to the most recent one when no year is
 * marked active. If the selected year disappears (deleted, school switch) it re-resolves.
 */
export function useSchoolYearSelection(schoolId: string | null | undefined) {
  const { data: schoolYears = [], isLoading } = useQuery({
    queryKey: ["school-years-all", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_years")
        .select("*")
        .eq("school_id", schoolId!)
        .order("year_range", { ascending: false });
      if (error) throw error;
      return (data || []) as SchoolYearOption[];
    },
    enabled: !!schoolId,
  });

  const [selectedYearId, setSelectedYearId] = useState("");

  useEffect(() => {
    if (schoolYears.length === 0) return;
    if (selectedYearId && schoolYears.some((y) => y.id === selectedYearId)) return;
    const active = schoolYears.find((y) => y.is_active);
    setSelectedYearId(active?.id ?? schoolYears[0].id);
  }, [schoolYears, selectedYearId]);

  const selectedYear = useMemo(
    () => schoolYears.find((y) => y.id === selectedYearId) || null,
    [schoolYears, selectedYearId],
  );

  return { schoolYears, selectedYearId, setSelectedYearId, selectedYear, isLoading };
}
