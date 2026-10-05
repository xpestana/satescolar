import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isSellableModuleKey, type SellableModuleKey } from "@/lib/modules/moduleCatalog";
import type { SchoolModuleState } from "@/lib/modules/moduleStatus";

export const allSchoolModulesQueryKey = ["admin-all-school-modules"] as const;

export type SchoolModulesBySchool = Map<string, Map<SellableModuleKey, SchoolModuleState>>;

/** Admin-only: modules of every school, grouped by school id (for the schools list). */
export function useAllSchoolModules() {
  return useQuery({
    queryKey: allSchoolModulesQueryKey,
    queryFn: async (): Promise<SchoolModulesBySchool> => {
      const { data, error } = await supabase
        .from("school_modules")
        .select("school_id, module_key, enabled, expires_at");
      if (error) throw error;
      const bySchool: SchoolModulesBySchool = new Map();
      for (const row of data) {
        if (!isSellableModuleKey(row.module_key)) continue;
        const states = bySchool.get(row.school_id) ?? new Map();
        states.set(row.module_key, { enabled: row.enabled, expires_at: row.expires_at });
        bySchool.set(row.school_id, states);
      }
      return bySchool;
    },
  });
}
