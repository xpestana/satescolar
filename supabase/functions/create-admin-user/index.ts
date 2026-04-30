import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Allowed roles that can be assigned via this endpoint (excludes 'admin' for security)
const ALLOWED_ROLES = ['school', 'representative'];

// Map internal errors to safe user-facing messages
function getSafeErrorMessage(error: any): string {
  console.error('Server error:', error);
  
  if (error.message?.includes('duplicate') || error.message?.includes('already registered')) {
    return 'Ya existe un usuario con ese correo electrónico';
  }
  if (error.message?.includes('invalid email')) {
    return 'El correo electrónico no es válido';
  }
  if (error.message?.includes('password')) {
    return 'La contraseña no cumple con los requisitos de seguridad';
  }
  
  return 'Error al procesar la solicitud';
}

export default async function handler(req: Request): Promise<Response> {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase admin client
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

    // Verify authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the requesting user's token
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

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

    // Now parse request body and proceed
    const { email, password, full_name, role, school_id } = await req.json();

    // Validate required fields
    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email y contraseña son requeridos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate role parameter - prevent admin creation via this endpoint
    if (!role) {
      return new Response(
        JSON.stringify({ error: "El rol es requerido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return new Response(
        JSON.stringify({ error: "Rol no válido. Solo se permiten los roles 'school' y 'representative'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate school_id is provided for school role
    if (role === 'school' && !school_id) {
      return new Response(
        JSON.stringify({ error: "school_id es requerido para el rol 'school'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create the user
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (createError) {
      return new Response(
        JSON.stringify({ error: getSafeErrorMessage(createError) }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If role is specified, insert into user_roles table
    if (role && userData.user) {
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({
          user_id: userData.user.id,
          role: role,
          school_id: school_id || null,
        });

      if (roleError) {
        console.error("Error assigning role:", roleError);
        // Don't expose role error details to client
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: { id: userData.user?.id, email: userData.user?.email } 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Error interno del servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

Deno.serve(handler);
