import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentSchoolId } from "@/hooks/useCurrentSchoolId";
import type { ModuleKey, SellableModuleKey } from "@/lib/modules/moduleCatalog";
import { isSellableModuleKey } from "@/lib/modules/moduleCatalog";
import { getModuleStatus, isModuleActive, type ModuleStatus, type SchoolModuleState } from "@/lib/modules/moduleStatus";

export const schoolModulesQueryKey = (schoolId: string | null) => ["school-modules", schoolId] as const;

/**
 * Modules enabled for the signed-in user's school (see docs/desc/19-modulos.md).
 * Admins bypass modules entirely: every module reports as active for them.
 */
export function useSchoolModules() {
  const { userRole } = useAuth();
  const { schoolId, isLoading: schoolLoading } = useCurrentSchoolId();
  const isAdmin = userRole === "admin";

  const { data, isLoading: modulesLoading } = useQuery({
    queryKey: schoolModulesQueryKey(schoolId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_modules")
        .select("module_key, enabled, expires_at")
        .eq("school_id", schoolId!);
      if (error) throw error;
      return data;
    },
    enabled: !!schoolId && !isAdmin,
    staleTime: 5 * 60_000,
  });

  const states = useMemo(() => {
    const map = new Map<SellableModuleKey, SchoolModuleState>();
    for (const row of data ?? []) {
      if (isSellableModuleKey(row.module_key)) {
        map.set(row.module_key, { enabled: row.enabled, expires_at: row.expires_at });
      }
    }
    return map;
  }, [data]);

  const isLoading = !isAdmin && (schoolLoading || (!!schoolId && modulesLoading));

  const getState = useCallback(
    (key: ModuleKey): SchoolModuleState | null => (key === "registration" ? null : states.get(key) ?? null),
    [states],
  );

  const isActive = useCallback(
    (key: ModuleKey): boolean => isAdmin || key === "registration" || isModuleActive(states.get(key)),
    [isAdmin, states],
  );

  const getStatus = useCallback(
    (key: ModuleKey): ModuleStatus =>
      isAdmin || key === "registration" ? "active" : getModuleStatus(states.get(key)),
    [isAdmin, states],
  );

  return { schoolId, isLoading, isActive, getState, getStatus };
}
