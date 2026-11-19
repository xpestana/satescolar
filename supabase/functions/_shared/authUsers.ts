/**
 * Auth user lookup by email. `auth.admin.listUsers()` without arguments only returns the FIRST
 * page (50 users), so an existing account outside that page looked "new" and `createUser` then
 * failed with "already registered". This walks every page.
 */

export interface AuthUserSummary {
  id: string;
  email?: string | null;
}

export interface AuthAdminLister {
  auth: {
    admin: {
      listUsers(params: { page: number; perPage: number }): Promise<{
        data: { users: AuthUserSummary[] } | null;
        error: unknown;
      }>;
    };
  };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findUserByEmail(
  admin: AuthAdminLister,
  email: string,
  perPage = 1000,
): Promise<AuthUserSummary | null> {
  const target = normalizeEmail(email);
  if (!target) return null;

  // Hard stop so a misbehaving API can never loop forever (1000 pages × 1000 users).
  for (let page = 1; page <= 1000; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users ?? [];
    const match = users.find((u) => u.email && normalizeEmail(u.email) === target);
    if (match) return match;
    if (users.length < perPage) return null;
  }
  return null;
}
