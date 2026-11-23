import { supabase } from "@/integrations/supabase/client";
import { getEdgeFunctionErrorMessage, throwIfBodyError } from "@/lib/edgeFunctionError";
import { SESSION_REVOKED_MESSAGE, verifyServerSession } from "@/lib/sessionGuard";

/**
 * Calls an Edge Function and throws an `Error` whose message is the Spanish text the function
 * returned (or `fallbackMessage`), instead of supabase-js' generic "non-2xx status code".
 */
export async function invokeEdgeFunction<T = Record<string, unknown>>(
  name: string,
  body: Record<string, unknown>,
  fallbackMessage: string,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    // A 401 usually means the session was revoked on the server: say so and send the user to log in.
    if (isUnauthorized(error) && (await verifyServerSession()) === "revoked") {
      throw new Error(SESSION_REVOKED_MESSAGE);
    }
    throw new Error(await getEdgeFunctionErrorMessage(error, fallbackMessage));
  }
  throwIfBodyError(data);
  return data as T;
}

function isUnauthorized(error: unknown): boolean {
  const context = (error as { context?: { status?: unknown } } | null)?.context;
  return context?.status === 401;
}
