import { useMemo } from "react";
import { useAuth } from "./useAuth";

export interface PermissionScope {
  grade_levels?: string[];
  school_year_ids?: string[];
}

export interface EffectivePermission {
  key: string;
  scopes: PermissionScope[]; // empty = unrestricted
}

interface PermissionsResult {
  isOwner: boolean;
  permissions: Map<string, PermissionScope[]>; // key -> array of scopes (empty array entry = unrestricted)
  has: (key: string) => boolean;
  hasInScope: (key: string, scope: { grade_level?: string; school_year_id?: string }) => boolean;
  loading: boolean;
}

/**
 * Permissions of a school user. The owner flag and a sub-user's permission items come with the
 * auth context (`get_my_context`), so there are no extra requests here.
 */
export function usePermissions(): PermissionsResult {
  const { user, userRole, context, loading: authLoading } = useAuth();

  const isOwner = userRole === "school" && !!context?.isOwner;

  const permissions = useMemo(() => {
    const map = new Map<string, PermissionScope[]>();
    if (userRole !== "school" || !context || context.isOwner) return map;
    for (const it of context.permissions) {
      const arr = map.get(it.key) ?? [];
      arr.push((it.scope ?? {}) as PermissionScope);
      map.set(it.key, arr);
    }
    return map;
  }, [userRole, context]);

  const has = (key: string) => {
    if (userRole !== "school") return false;
    if (isOwner) return true;
    return permissions.has(key);
  };

  const hasInScope = (
    key: string,
    scope: { grade_level?: string; school_year_id?: string }
  ) => {
    if (userRole !== "school") return false;
    if (isOwner) return true;
    const scopes = permissions.get(key);
    if (!scopes || scopes.length === 0) return false;
    return scopes.some((s) => {
      const gradeOk = !s.grade_levels || s.grade_levels.length === 0 || (scope.grade_level && s.grade_levels.includes(scope.grade_level));
      const yearOk = !s.school_year_ids || s.school_year_ids.length === 0 || (scope.school_year_id && s.school_year_ids.includes(scope.school_year_id));
      return gradeOk && yearOk;
    });
  };

  return { isOwner, permissions, has, hasInScope, loading: !!user && !context && authLoading };
}
