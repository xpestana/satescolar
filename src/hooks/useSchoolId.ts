import { useAuth } from "@/hooks/useAuth";

/**
 * `user_roles.school_id` of the signed-in user, from the auth context
 * (one `get_my_context` request, cached per user; see useAuth).
 */
export function useSchoolId() {
  const { user, context, loading } = useAuth();

  return {
    schoolId: context ? context.roleSchoolId : undefined,
    isLoading: !!user && !context && loading,
  };
}
