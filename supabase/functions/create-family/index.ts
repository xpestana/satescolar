import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the requesting user is authenticated and has school role
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

    // Get user's school_id from user_roles
    const { data: roleData, error: roleError } = await supabaseClient
      .from("user_roles")
      .select("school_id, role")
      .eq("user_id", user.id)
      .single();

    if (roleError || !roleData?.school_id) {
      return new Response(
        JSON.stringify({ error: "No tiene permisos para crear familias" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "El correo electrónico es requerido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate a generic password
    const genericPassword = "Familia2024!";

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      
      // Check if already has a family associated with this school
      const { data: existingFamilySchool } = await supabaseAdmin
        .from("family_schools")
        .select("id, families(id)")
        .eq("school_id", roleData.school_id)
        .eq("families.user_id", userId);

      // Check if any of the user's families are already in this school
      const { data: userFamilies } = await supabaseAdmin
        .from("families")
        .select("id")
        .eq("user_id", userId);

      if (userFamilies && userFamilies.length > 0) {
        const familyIds = userFamilies.map(f => f.id);
        const { data: existingAssoc } = await supabaseAdmin
          .from("family_schools")
          .select("id")
          .eq("school_id", roleData.school_id)
          .in("family_id", familyIds)
          .maybeSingle();

        if (existingAssoc) {
          return new Response(
            JSON.stringify({ error: "Ya existe una familia con este correo en esta institución" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Family exists but not in this school - associate it
        const familyId = userFamilies[0].id;
        const { error: assocError } = await supabaseAdmin
          .from("family_schools")
          .insert({ family_id: familyId, school_id: roleData.school_id });

        if (assocError) {
          console.error("Error associating family to school:", assocError);
          return new Response(
            JSON.stringify({ error: "Error al asociar la familia al colegio" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            family: { id: familyId },
            message: "Familia existente asociada a esta institución exitosamente"
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: genericPassword,
        email_confirm: true,
      });

      if (createError || !newUser.user) {
        console.error("Error creating user:", createError);
        return new Response(
          JSON.stringify({ error: "Error al crear el usuario" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userId = newUser.user.id;

      // Create user role as representative
      const { error: roleInsertError } = await supabaseAdmin
        .from("user_roles")
        .insert({
          user_id: userId,
          role: "representative",
          school_id: roleData.school_id,
        });

      if (roleInsertError) {
        console.error("Error creating role:", roleInsertError);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return new Response(
          JSON.stringify({ error: "Error al asignar rol al usuario" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Create the family (without school_id)
    const { data: family, error: familyError } = await supabaseAdmin
      .from("families")
      .insert({
        user_id: userId,
      })
      .select()
      .single();

    if (familyError) {
      console.error("Error creating family:", familyError);
      return new Response(
        JSON.stringify({ error: "Error al crear la familia" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create the family-school association
    const { error: assocError } = await supabaseAdmin
      .from("family_schools")
      .insert({
        family_id: family.id,
        school_id: roleData.school_id,
      });

    if (assocError) {
      console.error("Error creating family-school association:", assocError);
      return new Response(
        JSON.stringify({ error: "Error al asociar la familia al colegio" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        family,
        message: existingUser 
          ? "Familia creada exitosamente (usuario ya existía)" 
          : `Familia creada exitosamente. Contraseña temporal: ${genericPassword}`
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Error interno del servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
