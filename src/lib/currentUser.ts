import { supabase } from "@/integrations/supabase/client";

/**
 * Id of the signed-in user, read from the session this browser already holds (no request).
 * Use it for audit columns such as `created_by`; whether the session is still valid is checked by
 * the database on every request and by `verifyServerSession` (see sessionGuard).
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}
