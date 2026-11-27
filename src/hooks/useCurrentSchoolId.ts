import { useAuth } from "@/hooks/useAuth";

/**
 * School of the signed-in user, whatever their role:
 * school staff (user_roles), teacher (teachers) or representative (family_schools).
 * Admins have no school of their own and get null.
 * Resolved by `get_my_context` (see useAuth), so it no longer waits on per-role lookups.
 */
export function useCurrentSchoolId() {
  const { user, userRole, context, loading } = useAuth();

  if (userRole === "admin") return { schoolId: null, isLoading: false };
  return {
    schoolId: context?.schoolId ?? null,
    isLoading: !!user && !context && loading,
  };
}
