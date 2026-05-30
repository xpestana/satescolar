import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendViaSmtp } from "../_shared/smtp-client.ts";
import { buildWelcomeEmailHtml, resolveSnippets, wrapWithEmailLayout } from "../_shared/email-templates.ts";

// Prevent SMTP/TLS internal errors from crashing the edge worker.
if (typeof addEventListener === "function") {
  addEventListener("unhandledrejection", (e: any) => {
    console.error("[create-teacher] unhandledrejection swallowed:", e?.reason ?? e);
    e?.preventDefault?.();
  });
  addEventListener("error", (e: any) => {
    console.error("[create-teacher] uncaught error swallowed:", e?.error ?? e?.message ?? e);
    e?.preventDefault?.();
  });
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};


async function sendWelcomeEmail(to: string, schoolName: string, html: string) {
  try {
    const smtpHost = Deno.env.get("SMTP_HOST") ?? "";
    const smtpUser = Deno.env.get("SMTP_USER") ?? "";
    const smtpPass = Deno.env.get("SMTP_PASS") ?? "";
    const fromEmail = Deno.env.get("SMTP_FROM_EMAIL") ?? "";
    const fromName = Deno.env.get("SMTP_FROM_NAME") ?? "SAT Escolar";

    if (!smtpHost || !smtpUser || !smtpPass || !fromEmail) {
      console.log("SMTP not configured, skipping welcome email");
      return;
    }

    await sendViaSmtp({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject: `Bienvenido a ${schoolName} - SAT Escolar`,
      html,
    });
    console.log(`Welcome email sent to ${to}`);
  } catch (err) {
    console.error("Failed to send welcome email:", err);
  }
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

    const token = authHeader.replace("Bearer ", "");
    const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const user = { id: claimsData.claims.sub as string };

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

    const rawDocument = document_id.includes("-") ? document_id.split("-").slice(1).join("-") : document_id;
    const teacherPassword = rawDocument;

    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;

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

    // Fire and forget: send welcome email only for NEW users
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
          .eq("template_type", "welcome-teacher")
          .eq("is_active", true)
          .maybeSingle();

        let html: string;
        if (customTemplate) {
          const snippetData: Record<string, string> = {
            nombre_colegio: schoolData.name,
            email_usuario: email,
            contrasena: teacherPassword,
            url_plataforma: loginUrl,
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
            teacherPassword,
            "docente",
            loginUrl
          );
        }
        sendWelcomeEmail(email, schoolData.name, html).catch(console.error);
      }
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
}

if (import.meta.main) Deno.serve(handler);
