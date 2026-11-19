import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));

import { invokeEdgeFunction } from "./invokeEdgeFunction";

describe("invokeEdgeFunction", () => {
  beforeEach(() => invoke.mockReset());

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
