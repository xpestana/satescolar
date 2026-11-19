/**
 * Which accounts a school user may see the email of: only accounts linked to their own school(s)
 * — a role in the school (staff, teachers, representatives), a teacher record, or a family
 * associated with the school. Before, any school user could read any account's email.
 */

export interface ScopeRows {
  /** user_roles rows of the requested users in the caller's schools */
  roleUserIds: string[];
  /** teachers rows of the requested users in the caller's schools */
  teacherUserIds: string[];
  /** families of the requested users */
  families: { id: string; user_id: string | null }[];
  /** family ids associated with the caller's schools */
  schoolFamilyIds: string[];
}

export function allowedUserIds(requested: string[], rows: ScopeRows): Set<string> {
  const requestedSet = new Set(requested);
  const allowed = new Set<string>();
  for (const id of [...rows.roleUserIds, ...rows.teacherUserIds]) {
    if (requestedSet.has(id)) allowed.add(id);
  }
  const schoolFamilies = new Set(rows.schoolFamilyIds);
  for (const f of rows.families) {
    if (f.user_id && requestedSet.has(f.user_id) && schoolFamilies.has(f.id)) allowed.add(f.user_id);
  }
  return allowed;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any Supabase query builder
type Client = { from(table: string): any };

/** Loads the rows `allowedUserIds` needs for `requested` users within `schoolIds`. */
export async function loadScopeRows(client: Client, requested: string[], schoolIds: string[]): Promise<ScopeRows> {
  if (requested.length === 0 || schoolIds.length === 0) {
    return { roleUserIds: [], teacherUserIds: [], families: [], schoolFamilyIds: [] };
  }
  const [roles, teachers, families] = await Promise.all([
    client.from("user_roles").select("user_id").in("user_id", requested).in("school_id", schoolIds),
    client.from("teachers").select("user_id").in("user_id", requested).in("school_id", schoolIds),
    client.from("families").select("id, user_id").in("user_id", requested),
  ]);
  const familyRows = (families.data ?? []) as { id: string; user_id: string | null }[];
  const familyIds = familyRows.map((f) => f.id);
  const links = familyIds.length
    ? await client.from("family_schools").select("family_id").in("family_id", familyIds).in("school_id", schoolIds)
    : { data: [] };
  return {
    roleUserIds: ((roles.data ?? []) as { user_id: string }[]).map((r) => r.user_id),
    teacherUserIds: ((teachers.data ?? []) as { user_id: string | null }[]).map((t) => t.user_id).filter(Boolean) as string[],
    families: familyRows,
    schoolFamilyIds: ((links.data ?? []) as { family_id: string }[]).map((l) => l.family_id),
  };
}
