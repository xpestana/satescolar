import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  readPreferredSchoolYearId,
  rememberSchoolYearChoice,
  resolveSchoolYearId,
} from "@/lib/schoolYearPreference";

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
 * all scoped by `school_id`/`school_year_id`, so each year keeps its own books and any of them
 * can be selected safely.
 *
 * The choice is remembered per school in localStorage (see `schoolYearPreference`) and shared by
 * every payment screen, so reloading or moving between Registro, Estado de cuenta, Reporte…
 * keeps the year the user was working on instead of bouncing back to the active one. Without a
 * remembered choice it starts on the active year (or the most recent one if none is active).
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

  const [selectedYearId, setSelectedYearIdState] = useState("");

  useEffect(() => {
    if (!schoolId || schoolYears.length === 0) return;
    if (selectedYearId && schoolYears.some((y) => y.id === selectedYearId)) return;
    setSelectedYearIdState(resolveSchoolYearId(schoolYears, readPreferredSchoolYearId(schoolId)) ?? "");
  }, [schoolId, schoolYears, selectedYearId]);

  const setSelectedYearId = useCallback(
    (yearId: string) => {
      setSelectedYearIdState(yearId);
      if (schoolId) rememberSchoolYearChoice(schoolId, yearId, schoolYears);
    },
    [schoolId, schoolYears],
  );

  const selectedYear = useMemo(
    () => schoolYears.find((y) => y.id === selectedYearId) || null,
    [schoolYears, selectedYearId],
  );

  return { schoolYears, selectedYearId, setSelectedYearId, selectedYear, isLoading };
}
