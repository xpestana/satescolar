import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify requesting user has school or admin role
    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("school_id, role")
      .eq("user_id", user.id)
      .single();

    if (!roleData || !["school", "admin"].includes(roleData.role)) {
      return new Response(
        JSON.stringify({ error: "No tiene permisos" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { family_id, new_email } = await req.json();

    if (!family_id || !new_email) {
      return new Response(
        JSON.stringify({ error: "family_id y new_email son requeridos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the family to find the user_id
    const { data: family, error: familyError } = await supabaseAdmin
      .from("families")
      .select("user_id")
      .eq("id", family_id)
      .single();

    if (familyError || !family) {
      return new Response(
        JSON.stringify({ error: "Familia no encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If school role, verify the family belongs to their school
    if (roleData.role === "school") {
      const { data: familySchool } = await supabaseAdmin
        .from("family_schools")
        .select("id")
        .eq("family_id", family_id)
        .eq("school_id", roleData.school_id)
        .maybeSingle();

      if (!familySchool) {
        return new Response(
          JSON.stringify({ error: "No tiene acceso a esta familia" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Update the user's email
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      family.user_id,
      { email: new_email, email_confirm: true }
    );

    if (updateError) {
      console.error("Error updating email:", updateError);
      return new Response(
        JSON.stringify({ error: updateError.message || "Error al actualizar el correo" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Error interno del servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

Deno.serve(handler);
