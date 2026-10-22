import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * The same client without the generated schema, for tables and columns added by a migration
 * before `src/integrations/supabase/types.ts` is regenerated (that file is never edited by hand).
 * Callers type the rows they read themselves.
 */
export const untypedSupabase = supabase as unknown as SupabaseClient;
