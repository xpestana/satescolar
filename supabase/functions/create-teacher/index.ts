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
      auth: { autoRefreshToken: false, persistSession: false },
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
        JSON.stringify({ error: "No tiene permisos para crear docentes" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, password, form_data, photo_url, document_id, phone } = await req.json();

    if (!email || !document_id) {
      return new Response(
        JSON.stringify({ error: "El correo electrónico y el documento son requeridos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Password is the document number (without type prefix)
    const rawDocument = document_id.includes("-") ? document_id.split("-").slice(1).join("-") : document_id;
    const teacherPassword = rawDocument;

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;

      // Check if already a teacher at this school
      const { data: existingTeacher } = await supabaseAdmin
        .from("teachers")
        .select("id")
        .eq("user_id", userId)
        .eq("school_id", roleData.school_id)
        .maybeSingle();

      if (existingTeacher) {
        return new Response(
          JSON.stringify({ error: "Ya existe un docente con este correo en esta institución" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if user already has a teacher role, if not add it
      const { data: existingRole } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role", "teacher")
        .maybeSingle();

      if (!existingRole) {
        await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: userId, role: "teacher", school_id: roleData.school_id });
      }
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: teacherPassword,
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

      // Create user role as teacher
      const { error: roleInsertError } = await supabaseAdmin
        .from("user_roles")
        .insert({
          user_id: userId,
          role: "teacher",
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

    // Create the teacher record
    const { data: teacher, error: teacherError } = await supabaseAdmin
      .from("teachers")
      .insert({
        user_id: userId,
        school_id: roleData.school_id,
        form_data: form_data || {},
        photo_url: photo_url || null,
        document_id: document_id || null,
        phone: phone || null,
        email: email,
      })
      .select()
      .single();

    if (teacherError) {
      console.error("Error creating teacher:", teacherError);
      return new Response(
        JSON.stringify({ error: "Error al crear el docente" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        teacher,
        message: existingUser
          ? "Docente creado exitosamente (usuario ya existía)"
          : `Docente creado exitosamente. Contraseña temporal: ${teacherPassword}`,
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
