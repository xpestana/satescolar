import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type SchoolYearOption = Tables<"school_years">;

/** Every school year of a school, newest first. Shared cache for all year pickers. */
export function useSchoolYears(schoolId: string | null | undefined) {
  return useQuery({
    queryKey: ["school-years-all", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_years")
        .select("*")
        .eq("school_id", schoolId!)
        .order("year_range", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolId,
  });
}
