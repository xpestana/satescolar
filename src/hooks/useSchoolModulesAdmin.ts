import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isSellableModuleKey, type SellableModuleKey } from "@/lib/modules/moduleCatalog";
import type { SchoolModuleState } from "@/lib/modules/moduleStatus";
import { allSchoolModulesQueryKey } from "@/hooks/useAllSchoolModules";

export interface SchoolModuleUpdate {
  moduleKey: SellableModuleKey;
  enabled: boolean;
  expiresAt: string | null;
}

/** Admin-only: read and change the modules of one school. */
export function useSchoolModulesAdmin(schoolId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["admin-school-modules", schoolId] as const;

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_modules")
        .select("module_key, enabled, expires_at")
        .eq("school_id", schoolId!);
      if (error) throw error;
      const states = new Map<SellableModuleKey, SchoolModuleState>();
      for (const row of data) {
        if (isSellableModuleKey(row.module_key)) {
          states.set(row.module_key, { enabled: row.enabled, expires_at: row.expires_at });
        }
      }
      return states;
    },
    enabled: !!schoolId,
  });

  const schoolQuery = useQuery({
    queryKey: ["admin-school-name", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from("schools").select("name").eq("id", schoolId!).maybeSingle();
      if (error) throw error;
      return data?.name ?? null;
    },
    enabled: !!schoolId,
  });

  const mutation = useMutation({
    mutationFn: async (updates: SchoolModuleUpdate[]) => {
      const { error } = await supabase.from("school_modules").upsert(
        updates.map((u) => ({
          school_id: schoolId!,
          module_key: u.moduleKey,
          enabled: u.enabled,
          expires_at: u.expiresAt,
        })),
        { onConflict: "school_id,module_key" },
      );
      if (error) throw error;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: allSchoolModulesQueryKey });
    },
  });

  return {
    states: query.data ?? new Map<SellableModuleKey, SchoolModuleState>(),
    schoolName: schoolQuery.data ?? null,
    isLoading: query.isLoading || schoolQuery.isLoading,
    error: query.error,
    saveModules: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
}
