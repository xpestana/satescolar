import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

  try {
    const module = await import(`../${functionName}/index.ts`);
    // Edge runtime will call the default export or the served handler
    if (typeof module.default === "function") {
      return await module.default(req);
    }
    return new Response(JSON.stringify({ error: "No handler found" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: `Function '${functionName}' not found: ${error.message}` }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
