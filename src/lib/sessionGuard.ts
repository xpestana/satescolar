import { supabase } from "@/integrations/supabase/client";

/**
 * A session can die on the server while the browser still holds its access token: a global
 * sign-out from another browser (for example an admin ending an impersonation), a password reset
 * or a suspension deletes it from `auth.sessions`. Until that token expires, PostgREST keeps
 * accepting it (so lists still load), but every Edge Function that validates the caller with
 * `auth.getUser(token)` answers "No autorizado" and no real login is recorded.
 *
 * These helpers detect that state by asking Supabase Auth itself and, when the session is gone,
 * clear it from this browser so the user is sent to the login screen.
 */

/** Auth error codes that mean "this session/token is no longer valid on the server". */
const REVOKED_SESSION_CODES = new Set([
  "session_not_found",
  "session_expired",
  "refresh_token_not_found",
  "refresh_token_already_used",
  "bad_jwt",
  "user_not_found",
  "user_banned",
]);

interface AuthErrorLike {
  status?: unknown;
  code?: unknown;
  name?: unknown;
}

/** True when the Auth error says the session is gone; false for network or unknown errors. */
export function isRevokedSessionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { status, code, name } = error as AuthErrorLike;
  if (typeof code === "string" && REVOKED_SESSION_CODES.has(code)) return true;
  // Older GoTrue versions answer without `code`: a 401/403 from Auth's /user is a dead session.
  if (name === "AuthApiError" && (status === 401 || status === 403)) return true;
  return false;
}

export type SessionCheck = "valid" | "revoked" | "unknown";

/**
 * Asks Supabase Auth whether the current session still exists. When it was revoked, clears it from
 * this browser only (scope "local"), which triggers SIGNED_OUT and the redirect to login.
 * Network failures return "unknown" and keep the session: a bad connection is not a sign-out.
 */
export async function verifyServerSession(): Promise<SessionCheck> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return "unknown";

    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) return "valid";
    if (!isRevokedSessionError(error)) return "unknown";

    await supabase.auth.signOut({ scope: "local" });
    return "revoked";
  } catch {
    return "unknown";
  }
}

export const SESSION_REVOKED_MESSAGE =
  "Tu sesión se cerró o venció. Vuelve a iniciar sesión para continuar.";
