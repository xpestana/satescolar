/**
 * Whether a bearer token is a service-role JWT (cron / system calls).
 *
 * It only DECODES the payload: it is safe only in functions where the gateway verifies the JWT
 * signature (`verify_jwt = true`, the default). Do not use it in functions with `verify_jwt = false`.
 */
export function isServiceRoleToken(token: string): boolean {
  try {
    const part = token.split(".")[1];
    if (!part) return false;
    const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return payload?.role === "service_role";
  } catch {
    return false;
  }
}

/**
 * Verifies that a token really is the project's service-role key, also in functions with
 * `verify_jwt = false`, where anyone can send an unsigned token that only CLAIMS
 * `role: service_role`.
 * - Same value as the function's own key → accepted without a network call.
 * - Otherwise (e.g. a rotated key kept in Vault for the cron) it must claim service_role AND be
 *   accepted by an Auth admin endpoint, which checks the signature.
 */
export async function verifyServiceRoleToken(
  token: string,
  opts: { supabaseUrl: string; serviceRoleKey: string; fetchFn?: typeof fetch },
): Promise<boolean> {
  if (!token) return false;
  if (opts.serviceRoleKey && token === opts.serviceRoleKey) return true;
  if (!isServiceRoleToken(token) || !opts.supabaseUrl) return false;
  try {
    const res = await (opts.fetchFn ?? fetch)(`${opts.supabaseUrl}/auth/v1/admin/users?page=1&per_page=1`, {
      headers: { apikey: token, Authorization: `Bearer ${token}` },
    });
    await res.body?.cancel();
    return res.ok;
  } catch {
    return false;
  }
}

export function bearerToken(req: Request): string {
  return (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
}
