import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

export function usePermissions(): PermissionsResult {
  const { user, userRole } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["user-permissions", user?.id],
    enabled: !!user?.id && userRole === "school",
    staleTime: 60_000,
    queryFn: async () => {
      // is_owner?
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("is_owner, school_id")
        .eq("user_id", user!.id)
        .eq("role", "school")
        .maybeSingle();

      const isOwner = !!roleRow?.is_owner;

      if (isOwner) {
        return { isOwner: true, items: [] as Array<{ key: string; scope: any }> };
      }

      // sub-user: load assigned profiles -> items
      const { data: assigns } = await supabase
        .from("school_user_profiles")
        .select("profile_id")
        .eq("user_id", user!.id);

      const profileIds = (assigns ?? []).map((a: any) => a.profile_id);
      if (profileIds.length === 0) return { isOwner: false, items: [] };

      const { data: items } = await supabase
        .from("permission_profile_items")
        .select("permission_key, scope")
        .in("profile_id", profileIds);

      return {
        isOwner: false,
        items: (items ?? []).map((i: any) => ({ key: i.permission_key, scope: i.scope })),
      };
    },
  });

  const isOwner = !!data?.isOwner;
  const permissions = new Map<string, PermissionScope[]>();
  if (data && !isOwner) {
    for (const it of data.items) {
      const arr = permissions.get(it.key) ?? [];
      arr.push((it.scope ?? {}) as PermissionScope);
      permissions.set(it.key, arr);
    }
  }

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

  return { isOwner, permissions, has, hasInScope, loading: isLoading };
}
