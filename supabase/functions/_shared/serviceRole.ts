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

export function bearerToken(req: Request): string {
  return (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
}
