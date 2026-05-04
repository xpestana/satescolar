import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // VPS-compatible JWT validation: getClaims() can fall back to session-based auth
    // in self-hosted runtimes, which raises AuthSessionMissingError.
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    const requestingUserId = userData?.user?.id;

    if (userError || !requestingUserId) {
      console.error("Invalid token", userError);
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if requesting user is admin or school
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUserId)
      .in("role", ["admin", "school"])
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Unauthorized: Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const user_ids = body.user_ids || body.userIds;

    if (!user_ids || !Array.isArray(user_ids)) {
      return new Response(JSON.stringify({ error: "user_ids array is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate user_ids are valid UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const userId of user_ids) {
      if (typeof userId !== "string" || !uuidRegex.test(userId)) {
        return new Response(JSON.stringify({ error: "Invalid user_id format" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const userResults = await Promise.all(
      user_ids.map(async (userId: string) => {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
        return userData?.user
          ? {
              id: userData.user.id,
              email: userData.user.email,
              banned_until: userData.user.banned_until,
            }
          : null;
      })
    );

    const users = userResults.filter((u): u is NonNullable<typeof u> => u !== null);

    const emails: Record<string, string> = {};
    for (const user of users) {
      emails[user.id] = user.email || "";
    }

    return new Response(JSON.stringify({ users, emails }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[get-user-emails] Error:", message, error instanceof Error ? error.stack : undefined);
    return new Response(JSON.stringify({ error: "Internal server error", detail: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

if (import.meta.main) Deno.serve(handler);
