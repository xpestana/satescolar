/**
 * supabase-js returns `data = null` and a generic English message ("Edge Function returned a
 * non-2xx status code") whenever an Edge Function answers 4xx/5xx. The real Spanish message the
 * function sent (`{ error: "..." }`) lives in `error.context`, a `Response`. These helpers read it.
 */

const CONNECTION_ERROR = "No se pudo conectar con el servidor. Revise su conexión e intente de nuevo.";

interface ResponseLike {
  clone?: () => ResponseLike;
  json: () => Promise<unknown>;
}

function isResponseLike(value: unknown): value is ResponseLike {
  return typeof value === "object" && value !== null && typeof (value as ResponseLike).json === "function";
}

function errorFromBody(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const message = (body as { error?: unknown }).error;
  return typeof message === "string" && message.trim() ? message.trim() : null;
}

/** Spanish, user-facing message for an error returned by `supabase.functions.invoke`. */
export async function getEdgeFunctionErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (!error) return fallback;

  const context = (error as { context?: unknown }).context;
  if (isResponseLike(context)) {
    try {
      const response = typeof context.clone === "function" ? context.clone() : context;
      const fromBody = errorFromBody(await response.json());
      if (fromBody) return fromBody;
    } catch {
      // Body was not JSON or was already read: fall through to the generic handling.
    }
  }

  const name = (error as { name?: unknown }).name;
  if (name === "FunctionsFetchError" || name === "FunctionsRelayError") return CONNECTION_ERROR;

  const message = error instanceof Error ? error.message : "";
  if (message && !/non-2xx status code/i.test(message)) return message;
  return fallback;
}

/** Throws the error message of a 2xx answer shaped `{ error: "..." }` (older functions answer that way). */
export function throwIfBodyError(data: unknown): void {
  const fromBody = errorFromBody(data);
  if (fromBody) throw new Error(fromBody);
}
