import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getSafeErrorMessage(error: any): string {
  console.error("Server error:", error);
  if (error.message?.includes("duplicate") || error.message?.includes("already registered")) {
    return "Ya existe un usuario con ese correo electrónico";
  }
  if (error.message?.includes("invalid email")) {
    return "El correo electrónico no es válido";
  }
  if (error.message?.includes("password")) {
    return "La contraseña no cumple con los requisitos de seguridad";
  }
  return "Error al procesar la solicitud";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only existing admins can create new admins
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUserId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Acceso denegado: se requiere rol de administrador" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, password, full_name } = await req.json();

    if (!email || !password || !full_name) {
      return new Response(
        JSON.stringify({ error: "Email, contraseña y nombre son requeridos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (typeof password !== "string" || password.length < 8) {
      return new Response(
        JSON.stringify({ error: "La contraseña debe tener al menos 8 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: getSafeErrorMessage(createError) }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (userData.user) {
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userData.user.id, role: "admin", school_id: null });

      if (roleError) {
        console.error("Error assigning admin role:", roleError);
        // Rollback: delete the created user if role assignment fails
        await supabaseAdmin.auth.admin.deleteUser(userData.user.id);
        return new Response(
          JSON.stringify({ error: "Error al asignar el rol de administrador" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: true, user: { id: userData.user?.id, email: userData.user?.email } }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Error interno del servidor" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
