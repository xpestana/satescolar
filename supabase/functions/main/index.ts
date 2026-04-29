import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import updateSystemAdmin from "../update-system-admin/index.ts";

/** Rutas que el edge-runtime no resuelve bien con import() dinámico: deben quedar en el grafo estático. */
const staticHandlers: Record<string, (req: Request) => Promise<Response>> = {
  "update-system-admin": (req) => updateSystemAdmin(req),
};

serve(async (req: Request) => {
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const functionName = pathParts[0];

  if (!functionName) {
    return new Response(JSON.stringify({ error: "Function name required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const staticFn = staticHandlers[functionName];
  if (staticFn) {
    return await staticFn(req);
  }

  try {
    const module = await import(`../${functionName}/index.ts`);
    if (typeof module.default === "function") {
      return await module.default(req);
    }
    return new Response(JSON.stringify({ error: "No handler found" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: `Function '${functionName}' not found: ${message}` }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
