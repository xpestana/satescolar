import { useCallback, useEffect, useMemo, useState } from "react";
import {
  readPreferredSchoolYearId,
  rememberSchoolYearChoice,
  resolveSchoolYearId,
} from "@/lib/schoolYearPreference";
import { useSchoolYears, type SchoolYearOption } from "@/hooks/useSchoolYears";

export type { SchoolYearOption };

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
  const { data: schoolYears = [], isLoading } = useSchoolYears(schoolId);

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
