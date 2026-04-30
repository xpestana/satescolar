import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export default async function handler(req: Request): Promise<Response> {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the requesting user is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if requesting user is admin
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUser.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Acceso denegado: se requiere rol de administrador" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { user_id } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id es requerido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify target user exists and is NOT an admin (admins cannot impersonate other admins here)
    const { data: targetRoleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user_id)
      .maybeSingle();

    if (!targetRoleData) {
      return new Response(
        JSON.stringify({ error: "El usuario no tiene un rol asignado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (targetRoleData.role === "admin") {
      return new Response(
        JSON.stringify({ error: "No se puede suplantar a otro administrador" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const targetRole = targetRoleData.role;

    // Get target user's email
    const { data: targetUser, error: targetUserError } = await supabaseAdmin.auth.admin.getUserById(user_id);

    if (targetUserError || !targetUser.user) {
      console.error("Error getting target user:", targetUserError);
      return new Response(
        JSON.stringify({ error: "Usuario no encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate a magic link for the target user
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: targetUser.user.email!,
    });

    if (linkError || !linkData) {
      console.error("Error generating link:", linkError);
      return new Response(
        JSON.stringify({ error: "Error al generar enlace de acceso" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract the token from the link properties
    const { hashed_token } = linkData.properties;

    // Verify the OTP to get session tokens
    const { data: sessionData, error: verifyError } = await supabaseAdmin.auth.verifyOtp({
      token_hash: hashed_token,
      type: "magiclink",
    });

    if (verifyError || !sessionData.session) {
      console.error("Error verifying OTP:", verifyError);
      return new Response(
        JSON.stringify({ error: "Error al crear sesión" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        role: targetRole,
        session: {
          access_token: sessionData.session.access_token,
          refresh_token: sessionData.session.refresh_token,
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[impersonate-user] Unhandled error:", message, stack);
    return new Response(
      JSON.stringify({ error: "Error interno del servidor", detail: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

if (import.meta.main) Deno.serve(handler);
