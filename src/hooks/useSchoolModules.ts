import { useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { ModuleKey, SellableModuleKey } from "@/lib/modules/moduleCatalog";
import { isSellableModuleKey } from "@/lib/modules/moduleCatalog";
import { getModuleStatus, isModuleActive, type ModuleStatus, type SchoolModuleState } from "@/lib/modules/moduleStatus";

export const schoolModulesQueryKey = (schoolId: string | null) => ["school-modules", schoolId] as const;

/**
 * Modules enabled for the signed-in user's school (see docs/desc/19-modulos.md).
 * They come with the auth context (`get_my_context`), refreshed on load and when the tab returns.
 * Admins bypass modules entirely: every module reports as active for them.
 */
export function useSchoolModules() {
  const { user, userRole, context, loading } = useAuth();
  const isAdmin = userRole === "admin";
  const schoolId = isAdmin ? null : context?.schoolId ?? null;

  const states = useMemo(() => {
    const map = new Map<SellableModuleKey, SchoolModuleState>();
    for (const row of context?.modules ?? []) {
      if (isSellableModuleKey(row.module_key)) {
        map.set(row.module_key, { enabled: row.enabled, expires_at: row.expires_at });
      }
    }
    return map;
  }, [context]);

  const isLoading = !isAdmin && !!user && !context && loading;
  /**
   * Whether the school's modules are actually known. False while the role or the school id are
   * unresolved, or when the lookup failed: callers must not pitch a module as "not active" then.
   */
  const isResolved = isAdmin || (!!schoolId && !!context);

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

  return { schoolId, isLoading, isResolved, isActive, getState, getStatus };
}
