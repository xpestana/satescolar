/**
 * What the app needs to know about the signed-in user before drawing a screen,
 * as returned by the `get_my_context` database function, plus a per-user cache
 * in localStorage so a reload can paint at once while it is revalidated.
 *
 * The cache only decides what the UI shows first. Every request still goes out
 * with the session token and the database (RLS) decides what it may read.
 */

export type AppRole = "admin" | "school" | "representative" | "teacher";

export interface ModuleRow {
  module_key: string;
  enabled: boolean;
  expires_at: string | null;
}

export interface PermissionItem {
  key: string;
  scope: Record<string, unknown> | null;
}

export interface UserContext {
  role: AppRole | null;
  /** `user_roles.school_id` (what useSchoolId always returned, whatever the role). */
  roleSchoolId: string | null;
  /** School of the user for their role: staff, teacher or representative; null for admins. */
  schoolId: string | null;
  isOwner: boolean;
  teacherId: string | null;
  familyId: string | null;
  modules: ModuleRow[];
  permissions: PermissionItem[];
}

const ROLES: readonly AppRole[] = ["admin", "school", "representative", "teacher"];

const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

/** Turns the function's JSON into a UserContext. A missing/empty answer is "no role". */
export function parseUserContext(raw: unknown): UserContext {
  const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const role = ROLES.includes(d.role as AppRole) ? (d.role as AppRole) : null;
  const modules = Array.isArray(d.modules) ? d.modules : [];
  const permissions = Array.isArray(d.permissions) ? d.permissions : [];
  return {
    role,
    roleSchoolId: str(d.role_school_id),
    schoolId: str(d.school_id),
    isOwner: d.is_owner === true,
    teacherId: str(d.teacher_id),
    familyId: str(d.family_id),
    modules: modules
      .filter((m): m is Record<string, unknown> => !!m && typeof m === "object" && typeof (m as Record<string, unknown>).module_key === "string")
      .map((m) => ({
        module_key: m.module_key as string,
        enabled: m.enabled === true,
        expires_at: str(m.expires_at),
      })),
    permissions: permissions
      .filter((p): p is Record<string, unknown> => !!p && typeof p === "object" && typeof (p as Record<string, unknown>).key === "string")
      .map((p) => ({
        key: p.key as string,
        scope: p.scope && typeof p.scope === "object" ? (p.scope as Record<string, unknown>) : null,
      })),
  };
}

export const USER_CONTEXT_STORAGE_KEY = "satescolar:user-context:v1";

interface StoredContext {
  userId: string;
  savedAt: number;
  context: UserContext;
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStorage(): StorageLike | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** The cached context, only if it belongs to this user. Never throws. */
export function readCachedContext(userId: string, storage: StorageLike | null = defaultStorage()): UserContext | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(USER_CONTEXT_STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredContext;
    if (!stored || stored.userId !== userId || !stored.context) return null;
    return parseUserContext(toRaw(stored.context));
  } catch {
    return null;
  }
}

/** Keeps one entry: the current user's. Never throws. */
export function writeCachedContext(
  userId: string,
  context: UserContext,
  storage: StorageLike | null = defaultStorage(),
  now: number = Date.now(),
): void {
  if (!storage) return;
  try {
    const stored: StoredContext = { userId, savedAt: now, context };
    storage.setItem(USER_CONTEXT_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    /* storage full or blocked: the app works without the cache */
  }
}

export function clearCachedContext(storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(USER_CONTEXT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** UserContext back to the function's JSON shape, so cached data goes through the same parser. */
function toRaw(c: UserContext): Record<string, unknown> {
  return {
    role: c.role,
    role_school_id: c.roleSchoolId,
    school_id: c.schoolId,
    is_owner: c.isOwner,
    teacher_id: c.teacherId,
    family_id: c.familyId,
    modules: c.modules,
    permissions: c.permissions,
  };
}
