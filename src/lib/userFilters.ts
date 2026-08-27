/**
 * Filtering for the admin users list (`/admin/usuarios`).
 *
 * Pure functions so the page only wires state to UI: the list can grow to hundreds of users
 * across every school, and searching a single string over name/email was not enough to find
 * anyone (no accent folding, no way to narrow by role, school, suspension or activity).
 */

export type UserRoleKey = "school" | "teacher" | "representative";

/** Buckets of "how alive is this account", derived from the profile's login counters. */
export type ActivityFilter = "all" | "never" | "recent" | "dormant";

export type StatusFilter = "all" | "active" | "suspended";

/** School filter takes a school id, "all", or "none" for users with no institution. */
export type SchoolFilter = string;

export interface FilterableUser {
  full_name: string;
  email: string;
  school_id: string | null;
  school_name: string | null;
  role: UserRoleKey;
  is_suspended: boolean;
  login_count: number;
  last_login_at: string | null;
}

export interface UserFilters {
  search: string;
  role: UserRoleKey | "all";
  school: SchoolFilter;
  status: StatusFilter;
  activity: ActivityFilter;
}

export const EMPTY_USER_FILTERS: UserFilters = {
  search: "",
  role: "all",
  school: "all",
  status: "all",
  activity: "all",
};

export const ROLE_LABELS: Record<UserRoleKey, string> = {
  school: "Colegio",
  teacher: "Docente",
  representative: "Representante",
};

/** Days without logging in before an account that HAS logged in counts as dormant. */
export const DORMANT_AFTER_DAYS = 90;
/** Days back that count as recent activity. */
export const RECENT_WITHIN_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Lowercase and strip accents so "Jose" finds "José" and vice versa. */
export function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Every whitespace-separated term must appear somewhere in the user's searchable text, in any
 * order. Lets an admin type "maria luther" and land on María of Martin Luther King.
 */
export function matchesSearch(user: FilterableUser, search: string): boolean {
  const terms = normalizeText(search).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = normalizeText(
    [user.full_name, user.email, user.school_name || "", ROLE_LABELS[user.role]].join(" "),
  );
  return terms.every((term) => haystack.includes(term));
}

/** "moderate" = logged in, but neither recent nor dormant (between the two thresholds). */
export type ActivityBucket = "never" | "recent" | "dormant" | "moderate";

export function getActivityBucket(user: FilterableUser, now: number = Date.now()): ActivityBucket {
  if (!user.last_login_at || (user.login_count ?? 0) === 0) return "never";
  const last = new Date(user.last_login_at).getTime();
  if (Number.isNaN(last)) return "never";
  const days = (now - last) / DAY_MS;
  if (days <= RECENT_WITHIN_DAYS) return "recent";
  if (days > DORMANT_AFTER_DAYS) return "dormant";
  return "moderate";
}

export function matchesActivity(
  user: FilterableUser,
  activity: ActivityFilter,
  now: number = Date.now(),
): boolean {
  if (activity === "all") return true;
  return getActivityBucket(user, now) === activity;
}

export function matchesSchool(user: FilterableUser, school: SchoolFilter): boolean {
  if (school === "all") return true;
  if (school === "none") return !user.school_id && !user.school_name;
  return user.school_id === school;
}

export function matchesStatus(user: FilterableUser, status: StatusFilter): boolean {
  if (status === "all") return true;
  return status === "suspended" ? user.is_suspended : !user.is_suspended;
}

export function filterUsers<T extends FilterableUser>(
  users: T[],
  filters: UserFilters,
  now: number = Date.now(),
): T[] {
  return users.filter(
    (user) =>
      (filters.role === "all" || user.role === filters.role) &&
      matchesSchool(user, filters.school) &&
      matchesStatus(user, filters.status) &&
      matchesActivity(user, filters.activity, now) &&
      matchesSearch(user, filters.search),
  );
}

/** How many filters (search included) are narrowing the list right now. */
export function countActiveFilters(filters: UserFilters): number {
  let count = 0;
  if (filters.search.trim()) count++;
  if (filters.role !== "all") count++;
  if (filters.school !== "all") count++;
  if (filters.status !== "all") count++;
  if (filters.activity !== "all") count++;
  return count;
}

/**
 * Counts per role over a list, for the role selector. Counting on the list already narrowed by
 * the OTHER filters keeps the numbers honest ("3 docentes" means 3 under the current view).
 */
export function countByRole(users: FilterableUser[]): Record<UserRoleKey | "all", number> {
  const counts: Record<UserRoleKey | "all", number> = {
    all: users.length,
    school: 0,
    teacher: 0,
    representative: 0,
  };
  users.forEach((u) => {
    if (u.role in counts) counts[u.role]++;
  });
  return counts;
}
