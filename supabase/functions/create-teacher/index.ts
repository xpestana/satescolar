import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildWelcomeEmailHtml(
  schoolName: string,
  schoolLogoUrl: string | null,
  userEmail: string,
  password: string,
  role: "representante" | "docente",
  platformUrl: string
): string {
  const logoBlock = schoolLogoUrl
    ? `<img src="${schoolLogoUrl}" alt="${schoolName}" style="max-height:80px;max-width:200px;margin-bottom:12px;" />`
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:32px 0;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <!-- Header -->
  <tr><td align="center" style="padding:32px 24px 16px;background-color:#f8f9fc;border-bottom:1px solid #e8e8ed;">
    ${logoBlock}
    <h2 style="margin:0;font-size:20px;color:#1a1a2e;">${schoolName}</h2>
  </td></tr>
  <!-- Body -->
  <tr><td style="padding:32px 32px 24px;">
    <h1 style="margin:0 0 16px;font-size:24px;color:#1a1a2e;">¡Bienvenido/a!</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4a4a5a;">
      Ha sido registrado como <strong>${role}</strong> en <strong>${schoolName}</strong> a través de la plataforma <strong>SAT Escolar</strong>.
    </p>
    <p style="margin:0 0 8px;font-size:15px;color:#4a4a5a;">Sus credenciales de acceso:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f4ff;border-radius:8px;margin:12px 0 24px;">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0 0 6px;font-size:14px;color:#6b7280;">Usuario</p>
        <p style="margin:0 0 12px;font-size:16px;font-weight:bold;color:#1a1a2e;">${userEmail}</p>
        <p style="margin:0 0 6px;font-size:14px;color:#6b7280;">Contraseña</p>
        <p style="margin:0;font-size:16px;font-weight:bold;color:#1a1a2e;">${password}</p>
      </td></tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center" style="padding:8px 0 16px;">
        <a href="${platformUrl}" target="_blank" style="display:inline-block;padding:14px 32px;background-color:#1e78c8;color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none;border-radius:8px;">Ingresar a la Plataforma</a>
      </td></tr>
    </table>
    <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;">Le recomendamos cambiar su contraseña una vez ingrese al sistema.</p>
  </td></tr>
  <!-- Footer -->
  <tr><td align="center" style="padding:20px 24px;background-color:#f8f9fc;border-top:1px solid #e8e8ed;">
    <p style="margin:0 0 4px;font-size:13px;font-weight:bold;color:#6b7280;">SAT ESCOLAR</p>
    <a href="https://satescolar.com" target="_blank" style="font-size:13px;color:#1e78c8;text-decoration:none;">satescolar.com</a>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

async function sendWelcomeEmail(to: string, schoolName: string, html: string) {
  try {
    const smtpHost = Deno.env.get("SMTP_HOST") ?? "";
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") ?? "587");
    const smtpUser = Deno.env.get("SMTP_USER") ?? "";
    const smtpPass = Deno.env.get("SMTP_PASS") ?? "";
    const fromEmail = Deno.env.get("SMTP_FROM_EMAIL") ?? "";
    const fromName = Deno.env.get("SMTP_FROM_NAME") ?? "SAT Escolar";

    if (!smtpHost || !smtpUser || !smtpPass || !fromEmail) {
      console.log("SMTP not configured, skipping welcome email");
      return;
    }

    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: smtpPort === 465,
        auth: { username: smtpUser, password: smtpPass },
      },
    });

    await client.send({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject: `Bienvenido a ${schoolName} - SAT Escolar`,
      html,
      headers: {
        "From": `${fromName} <${fromEmail}>`,
      },
    });
    await client.close();
    console.log(`Welcome email sent to ${to}`);
  } catch (err) {
    console.error("Failed to send welcome email:", err);
  }
}

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
        const html = buildWelcomeEmailHtml(
          schoolData.name,
          schoolData.logo_url,
          email,
          teacherPassword,
          "docente",
          "https://satescolar.lovable.app"
        );
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
});
