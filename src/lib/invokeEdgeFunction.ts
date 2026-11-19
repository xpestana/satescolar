import { supabase } from "@/integrations/supabase/client";
import { getEdgeFunctionErrorMessage, throwIfBodyError } from "@/lib/edgeFunctionError";

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
  if (error) throw new Error(await getEdgeFunctionErrorMessage(error, fallbackMessage));
  throwIfBodyError(data);
  return data as T;
}
