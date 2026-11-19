/**
 * Resolves which role the caller acts with. `user_roles` holds one row per role (a school
 * employee can also be a representative), so `.single()` failed for those users and anyone with a
 * `school_id` (teachers, representatives) passed the old checks. Here only the allowed roles count.
 */

export interface RoleRow {
  role: string;
  school_id: string | null;
  is_owner?: boolean | null;
}

export interface UserRolesReader {
  from(table: "user_roles"): {
    select(columns: string): {
      eq(column: "user_id", value: string): {
        in(column: "role", values: string[]): PromiseLike<{ data: RoleRow[] | null; error: unknown }>;
      };
    };
  };
}

/**
 * Picks the first row whose role is allowed, following the order of `allowedRoles`.
 * With `requireSchool`, rows without `school_id` are ignored.
 */
export function pickCallerRole(
  rows: RoleRow[] | null | undefined,
  allowedRoles: string[],
  options: { requireSchool?: boolean } = {},
): RoleRow | null {
  for (const role of allowedRoles) {
    const row = (rows ?? []).find((r) => r.role === role && (!options.requireSchool || !!r.school_id));
    if (row) return row;
  }
  return null;
}

export async function getCallerRole(
  client: UserRolesReader,
  userId: string,
  allowedRoles: string[],
  options: { requireSchool?: boolean } = {},
): Promise<RoleRow | null> {
  const { data, error } = await client
    .from("user_roles")
    .select("role, school_id, is_owner")
    .eq("user_id", userId)
    .in("role", allowedRoles);
  if (error) throw error;
  return pickCallerRole(data, allowedRoles, options);
}
