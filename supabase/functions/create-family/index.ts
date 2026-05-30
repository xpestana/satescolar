import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendViaSmtp } from "../_shared/smtp-client.ts";
import { buildWelcomeEmailHtml, resolveSnippets, wrapWithEmailLayout } from "../_shared/email-templates.ts";

// Prevent SMTP/TLS internal errors from crashing the edge worker.
// Without this, a failed sendWelcomeEmail (e.g. self-hosted SMTP misconfigured)
// can escape the event loop and tear down the runtime, causing every
// subsequent function (impersonate-user, get-user-emails, etc.) to 500.
if (typeof addEventListener === "function") {
  addEventListener("unhandledrejection", (e: any) => {
    console.error("[create-family] unhandledrejection swallowed:", e?.reason ?? e);
    e?.preventDefault?.();
  });
  addEventListener("error", (e: any) => {
    console.error("[create-family] uncaught error swallowed:", e?.error ?? e?.message ?? e);
    e?.preventDefault?.();
  });
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};



async function sendWelcomeEmail(to: string, schoolName: string, html: string) {
  const smtpHost = Deno.env.get("SMTP_HOST") ?? "";
  const smtpUser = Deno.env.get("SMTP_USER") ?? "";
  const smtpPass = Deno.env.get("SMTP_PASS") ?? "";
  const fromEmail = Deno.env.get("SMTP_FROM_EMAIL") ?? "";
  const fromName = Deno.env.get("SMTP_FROM_NAME") ?? "SAT Escolar";

  if (!smtpHost || !smtpUser || !smtpPass || !fromEmail) {
    console.log("SMTP not configured, skipping welcome email");
    return;
  }

  try {
    await Promise.race([
      sendViaSmtp({
        from: `${fromName} <${fromEmail}>`,
        to: [to],
        subject: `Bienvenido a ${schoolName} - SAT Escolar`,
        html,
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("SMTP send timeout (15s)")), 15000)
      ),
    ]);
    console.log(`Welcome email sent to ${to}`);
  } catch (err) {
    console.error("Failed to send welcome email:", err);
  }
}


function generateRandomPassword(length = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join('');
}

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

    const genericPassword = generateRandomPassword();

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;

      // ── NEW: Validate existing user's role ──
      // Block if user has a non-representative role (admin, school, teacher)
      const { data: existingRoles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      const nonRepRoles = (existingRoles || []).filter(r => r.role !== "representative");
      if (nonRepRoles.length > 0) {
        return new Response(
          JSON.stringify({ error: "Este correo pertenece a una cuenta administrativa o docente. Use un correo diferente para la familia." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if user already has a family
      const { data: userFamilies } = await supabaseAdmin
        .from("families")
        .select("id")
        .eq("user_id", userId);

      if (userFamilies && userFamilies.length > 0) {
        const familyIds = userFamilies.map(f => f.id);
        
        // Check if already associated with this school
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

        // Associate existing family to this school
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

        // Ensure user has representative role for this school
        await supabaseAdmin
          .from("user_roles")
          .upsert(
            { user_id: userId, role: "representative", school_id: roleData.school_id },
            { onConflict: "user_id,role,school_id", ignoreDuplicates: true }
          );

        return new Response(
          JSON.stringify({
            success: true,
            family: { id: familyId },
            message: "Familia existente asociada a esta institución exitosamente"
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // User exists but has no family — ensure they have representative role, then create family
      await supabaseAdmin
        .from("user_roles")
        .upsert(
          { user_id: userId, role: "representative", school_id: roleData.school_id },
          { onConflict: "user_id,role,school_id", ignoreDuplicates: true }
        );

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

    // Create family record
    const { data: family, error: familyError } = await supabaseAdmin
      .from("families")
      .insert({ user_id: userId })
      .select()
      .single();

    if (familyError) {
      console.error("Error creating family:", familyError);
      return new Response(
        JSON.stringify({ error: "Error al crear la familia" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: assocError } = await supabaseAdmin
      .from("family_schools")
      .insert({ family_id: family.id, school_id: roleData.school_id });

    if (assocError) {
      console.error("Error creating family-school association:", assocError);
      return new Response(
        JSON.stringify({ error: "Error al asociar la familia al colegio" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send welcome email only for NEW users
    if (!existingUser) {
      const { data: schoolData } = await supabaseAdmin
        .from("schools")
        .select("name, logo_url")
        .eq("id", roleData.school_id)
        .single();

      if (schoolData) {
        const loginUrl = "https://app.satescolar.com/login";
        const { data: customTemplate } = await supabaseAdmin
          .from("email_templates")
          .select("subject, body_html, primary_color, text_color")
          .eq("school_id", roleData.school_id)
          .eq("template_type", "welcome-family")
          .eq("is_active", true)
          .maybeSingle();

        let html: string;
        if (customTemplate) {
          const snippetData: Record<string, string> = {
            nombre_colegio: schoolData.name,
            email_usuario: email,
            contrasena: genericPassword,
            url_plataforma: loginUrl,
            primary_color: customTemplate.primary_color,
          };
          html = wrapWithEmailLayout(
            resolveSnippets(customTemplate.body_html, snippetData),
            customTemplate.primary_color,
            customTemplate.text_color,
            schoolData.name,
            schoolData.logo_url
          );
        } else {
          html = buildWelcomeEmailHtml(
            schoolData.name,
            schoolData.logo_url,
            email,
            genericPassword,
            "representante",
            loginUrl
          );
        }
        sendWelcomeEmail(email, schoolData.name, html).catch(console.error);
      }
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
}

if (import.meta.main) Deno.serve(handler);
