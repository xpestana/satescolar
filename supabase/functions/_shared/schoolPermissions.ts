import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Whether a school user holds a permission: owners hold every permission; other users hold the
 * ones granted by their permission profiles (same rule as `usePermissions` in the app).
 */
export async function hasSchoolPermission(
  admin: SupabaseClient,
  opts: { userId: string; schoolId: string; isOwner: boolean; permission: string },
): Promise<boolean> {
  if (opts.isOwner) return true;

  const { data: assigns } = await admin
    .from("school_user_profiles")
    .select("profile_id")
    .eq("user_id", opts.userId)
    .eq("school_id", opts.schoolId);
  const profileIds = (assigns ?? []).map((a: { profile_id: string }) => a.profile_id);
  if (profileIds.length === 0) return false;

  const { data: items } = await admin
    .from("permission_profile_items")
    .select("permission_key")
    .in("profile_id", profileIds)
    .eq("permission_key", opts.permission)
    .limit(1);
  return (items?.length ?? 0) > 0;
}
