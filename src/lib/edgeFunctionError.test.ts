import { describe, expect, it } from "vitest";
import { getEdgeFunctionErrorMessage, throwIfBodyError } from "./edgeFunctionError";

class FakeHttpError extends Error {
  name = "FunctionsHttpError";
  constructor(public context: Response) {
    super("Edge Function returned a non-2xx status code");
  }
}

const jsonResponse = (body: unknown, status = 400) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("getEdgeFunctionErrorMessage", () => {
  it("returns the Spanish message the function sent in the body", async () => {
    const error = new FakeHttpError(jsonResponse({ error: "Ya existe una familia con este correo en esta institución" }));
    await expect(getEdgeFunctionErrorMessage(error, "fallback")).resolves.toBe(
      "Ya existe una familia con este correo en esta institución",
    );
  });

  it("can read the same error twice (does not consume the body)", async () => {
    const error = new FakeHttpError(jsonResponse({ error: "Sin permisos" }, 403));
    await getEdgeFunctionErrorMessage(error, "fallback");
    await expect(getEdgeFunctionErrorMessage(error, "fallback")).resolves.toBe("Sin permisos");
  });

  it("uses the fallback instead of the generic English message", async () => {
    const error = new FakeHttpError(new Response("<html>bad gateway</html>", { status: 502 }));
    await expect(getEdgeFunctionErrorMessage(error, "No se pudo crear la familia")).resolves.toBe(
      "No se pudo crear la familia",
    );
  });

  it("uses the fallback when the body has an empty error", async () => {
    const error = new FakeHttpError(jsonResponse({ error: "  " }, 500));
    await expect(getEdgeFunctionErrorMessage(error, "fallback")).resolves.toBe("fallback");
  });

  it("explains connection problems in Spanish", async () => {
    const error = Object.assign(new Error("Failed to send a request to the Edge Function"), {
      name: "FunctionsFetchError",
    });
    await expect(getEdgeFunctionErrorMessage(error, "fallback")).resolves.toMatch(/No se pudo conectar/);
  });

  it("keeps the message of any other error", async () => {
    await expect(getEdgeFunctionErrorMessage(new Error("Algo concreto"), "fallback")).resolves.toBe("Algo concreto");
  });

  it("returns the fallback for empty errors", async () => {
    await expect(getEdgeFunctionErrorMessage(null, "fallback")).resolves.toBe("fallback");
    await expect(getEdgeFunctionErrorMessage({}, "fallback")).resolves.toBe("fallback");
  });
});

describe("throwIfBodyError", () => {
  it("throws the error carried in a 2xx body", () => {
    expect(() => throwIfBodyError({ error: "Correo inválido" })).toThrow("Correo inválido");
  });

  it("does nothing for successful bodies", () => {
    expect(() => throwIfBodyError({ success: true })).not.toThrow();
    expect(() => throwIfBodyError(null)).not.toThrow();
  });
});
