import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke, verifyServerSession } = vi.hoisted(() => ({ invoke: vi.fn(), verifyServerSession: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));
vi.mock("@/lib/sessionGuard", () => ({
  verifyServerSession,
  SESSION_REVOKED_MESSAGE: "Tu sesión se cerró o venció. Vuelve a iniciar sesión para continuar.",
}));

import { invokeEdgeFunction } from "./invokeEdgeFunction";

describe("invokeEdgeFunction", () => {
  beforeEach(() => {
    invoke.mockReset();
    verifyServerSession.mockReset().mockResolvedValue("valid");
  });

  const unauthorized = () => ({
    data: null,
    error: Object.assign(new Error("Edge Function returned a non-2xx status code"), {
      context: new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    }),
  });

  it("explains a revoked session instead of a bare 'No autorizado'", async () => {
    invoke.mockResolvedValue(unauthorized());
    verifyServerSession.mockResolvedValue("revoked");
    await expect(invokeEdgeFunction("manage-school-subuser", {}, "fallback")).rejects.toThrow(
      "Tu sesión se cerró o venció",
    );
  });

  it("keeps the function's message on a 401 when the session is still valid", async () => {
    invoke.mockResolvedValue(unauthorized());
    await expect(invokeEdgeFunction("manage-school-subuser", {}, "fallback")).rejects.toThrow("No autorizado");
  });

  it("returns the data on success", async () => {
    invoke.mockResolvedValue({ data: { success: true, email_sent: true }, error: null });
    await expect(invokeEdgeFunction("create-family", { email: "a@example.com" }, "fallback")).resolves.toEqual({
      success: true,
      email_sent: true,
    });
    expect(invoke).toHaveBeenCalledWith("create-family", { body: { email: "a@example.com" } });
  });

  it("throws the Spanish message of a non-2xx answer", async () => {
    const context = new Response(JSON.stringify({ error: "Este correo pertenece a una cuenta docente" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
    invoke.mockResolvedValue({
      data: null,
      error: Object.assign(new Error("Edge Function returned a non-2xx status code"), { context }),
    });
    await expect(invokeEdgeFunction("create-family", {}, "fallback")).rejects.toThrow(
      "Este correo pertenece a una cuenta docente",
    );
  });

  it("throws an error carried in a 2xx body", async () => {
    invoke.mockResolvedValue({ data: { error: "Acción inválida" }, error: null });
    await expect(invokeEdgeFunction("manage-school-subuser", {}, "fallback")).rejects.toThrow("Acción inválida");
  });
});
