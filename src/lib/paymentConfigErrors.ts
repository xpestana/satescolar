/**
 * User-facing messages for errors raised while editing payment concepts and plans.
 *
 * Plan concepts with invoice lines (`payment_items`) or exonerations are protected by
 * `ON DELETE RESTRICT`, so deleting them fails with a foreign-key violation (23503). The raw
 * PostgREST text is meaningless for the school staff, so it is translated here.
 */

export const HAS_HISTORY_MESSAGE =
  "No se puede eliminar porque tiene pagos o exoneraciones registrados. Desactívelo en lugar de borrarlo.";

const FALLBACK_MESSAGE = "Ocurrió un error inesperado";

interface DbErrorLike {
  code?: unknown;
  message?: unknown;
}

export function friendlyPaymentConfigError(error: unknown): string {
  if (typeof error === "string") return error || FALLBACK_MESSAGE;
  if (typeof error !== "object" || error === null) return FALLBACK_MESSAGE;
  const { code, message } = error as DbErrorLike;
  if (code === "23503") return HAS_HISTORY_MESSAGE;
  return typeof message === "string" && message ? message : FALLBACK_MESSAGE;
}
