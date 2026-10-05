// Per-school module gating for Edge Functions (see docs/desc/19-modulos.md).
// Uses the SQL helper `school_has_module`, so the rule lives in one place.

export type SellableModuleKey =
  | "messaging"
  | "payments"
  | "grades"
  | "ministry_forms"
  | "attendance"
  | "virtual_classroom";

interface RpcClient {
  // deno-lint-ignore no-explicit-any
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: any; error: any }>;
}

/**
 * True when the school has the module active. On a database error it fails open
 * (returns true) so a transient failure never blocks a paying school; the error is logged.
 */
export async function isSchoolModuleActive(
  client: RpcClient,
  schoolId: string | null | undefined,
  moduleKey: SellableModuleKey,
): Promise<boolean> {
  if (!schoolId) return false;
  const { data, error } = await client.rpc("school_has_module", {
    _school_id: schoolId,
    _module: moduleKey,
  });
  if (error) {
    console.error(`[schoolModules] school_has_module(${schoolId}, ${moduleKey}) failed:`, error);
    return true;
  }
  return data === true;
}
