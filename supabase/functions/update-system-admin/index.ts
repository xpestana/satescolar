import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getSafeErrorMessage(error: unknown): string {
  console.error("Server error:", error);
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("duplicate") || message.includes("already been registered")) {
    return "Ya existe un usuario con ese correo electrónico";
  }
  if (message.toLowerCase().includes("invalid email")) {
    return "El correo electrónico no es válido";
  }
  if (message.includes("password")) {
    return "La contraseña no cumple con los requisitos de seguridad";
  }
  return "Error al actualizar el administrador";
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false },
      }
    );

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    const requestingUserId = claimsData?.claims?.sub;
    if (claimsError || !requestingUserId) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUserId)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminRole) {
      return new Response(
        JSON.stringify({ error: "Acceso denegado: se requiere rol de administrador" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const user_id = body.user_id as string | undefined;
    const full_name = typeof body.full_name === "string" ? body.full_name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const phone =
      body.phone === null || body.phone === undefined
        ? undefined
        : String(body.phone).trim() || null;

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id es requerido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!full_name || !email) {
      return new Response(
        JSON.stringify({ error: "Nombre completo y correo son requeridos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length > 0 && password.length < 8) {
      return new Response(
        JSON.stringify({ error: "La contraseña debe tener al menos 8 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: targetRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user_id)
      .eq("role", "admin")
      .maybeSingle();

    if (!targetRole) {
      return new Response(
        JSON.stringify({ error: "El usuario indicado no es administrador del sistema" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: existingAuth, error: getUserErr } = await supabaseAdmin.auth.admin.getUserById(
      user_id
    );
    if (getUserErr || !existingAuth?.user) {
      return new Response(JSON.stringify({ error: "Usuario no encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prevMeta = (existingAuth.user.user_metadata ?? {}) as Record<string, unknown>;
    const user_metadata = { ...prevMeta, full_name };

    const authUpdate: {
      email?: string;
      password?: string;
      user_metadata: Record<string, unknown>;
    } = { user_metadata };

    if (email !== (existingAuth.user.email ?? "")) {
      authUpdate.email = email;
    }
    if (password.length > 0) {
      authUpdate.password = password;
    }

    const { error: updAuthErr } = await supabaseAdmin.auth.admin.updateUserById(user_id, authUpdate);
    if (updAuthErr) {
      return new Response(JSON.stringify({ error: getSafeErrorMessage(updAuthErr) }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const profileUpdate: { full_name: string; phone?: string | null } = { full_name };
    if (phone !== undefined) {
      profileUpdate.phone = phone;
    }

    const { error: profileErr } = await supabaseAdmin
      .from("profiles")
      .update(profileUpdate)
      .eq("user_id", user_id);

    if (profileErr) {
      console.error("Error updating profile:", profileErr);
      return new Response(
        JSON.stringify({ error: "Error al actualizar el perfil en base de datos" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Error interno del servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
