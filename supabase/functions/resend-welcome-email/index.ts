// Prevent SMTP/TLS internal errors from crashing the edge worker.
if (typeof addEventListener === "function") {
  addEventListener("unhandledrejection", (e: any) => {
    console.error("[resend-welcome-email] unhandledrejection swallowed:", e?.reason ?? e);
    e?.preventDefault?.();
  });
  addEventListener("error", (e: any) => {
    console.error("[resend-welcome-email] uncaught error swallowed:", e?.error ?? e?.message ?? e);
    e?.preventDefault?.();
  });
}

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateRandomPassword(length = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join('');
}

function buildWelcomeEmailHtml(
  schoolName: string,
  schoolLogoUrl: string | null,
  userEmail: string,
  password: string,
  role: "representante" | "docente",
  loginUrl: string
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
  <tr><td align="center" style="padding:32px 24px 16px;background-color:#f8f9fc;border-bottom:1px solid #e8e8ed;">
    ${logoBlock}
    <h2 style="margin:0;font-size:20px;color:#1a1a2e;">${schoolName}</h2>
  </td></tr>
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
        <a href="${loginUrl}" target="_blank" style="display:inline-block;padding:14px 32px;background-color:#1e78c8;color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none;border-radius:8px;">Ingresar a la Plataforma</a>
      </td></tr>
    </table>
    <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;">Le recomendamos cambiar su contraseña una vez ingrese al sistema.</p>
  </td></tr>
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

    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("school_id, role")
      .eq("user_id", user.id)
      .single();

    if (!roleData || !["school", "admin"].includes(roleData.role) || !roleData.school_id) {
      return new Response(
        JSON.stringify({ error: "No tiene permisos" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { family_id, target_type } = await req.json();
    // target_type: "family" or "teacher"

    if (!family_id) {
      return new Response(
        JSON.stringify({ error: "family_id es requerido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let targetUserId: string;
    let targetEmail: string;
    let role: "representante" | "docente";

    let teacherDocumentId: string | null = null;

    if (target_type === "teacher") {
      // Get teacher data including document_id
      const { data: teacher, error: teacherError } = await supabaseAdmin
        .from("teachers")
        .select("user_id, email, document_id")
        .eq("id", family_id)
        .eq("school_id", roleData.school_id)
        .single();

      if (teacherError || !teacher || !teacher.user_id) {
        return new Response(
          JSON.stringify({ error: "Docente no encontrado" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      targetUserId = teacher.user_id;
      targetEmail = teacher.email || "";
      teacherDocumentId = teacher.document_id || null;
      role = "docente";
    } else {
      // Get family data
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

      // Verify family belongs to school
      const { data: familySchool } = await supabaseAdmin
        .from("family_schools")
        .select("id")
        .eq("family_id", family_id)
        .eq("school_id", roleData.school_id)
        .maybeSingle();

      if (!familySchool) {
        return new Response(
          JSON.stringify({ error: "No tiene permisos sobre esta familia" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      targetUserId = family.user_id;
      role = "representante";

      // Get email from auth
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
      targetEmail = authUser?.user?.email || "";
    }

    if (!targetEmail) {
      return new Response(
        JSON.stringify({ error: "No se encontró el correo del usuario" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For teachers: use document_id (without prefix) as password; for families: generate random
    let newPassword: string;
    if (target_type === "teacher" && teacherDocumentId) {
      const rawDoc = teacherDocumentId.includes("-")
        ? teacherDocumentId.split("-").slice(1).join("-")
        : teacherDocumentId;
      newPassword = rawDoc;
    } else {
      newPassword = generateRandomPassword();
    }
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      targetUserId,
      { password: newPassword }
    );

    if (updateError) {
      console.error("Error updating password:", updateError);
      return new Response(
        JSON.stringify({ error: "Error al actualizar la contraseña" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get school data for email
    const { data: schoolData } = await supabaseAdmin
      .from("schools")
      .select("name, logo_url")
      .eq("id", roleData.school_id)
      .single();

    if (!schoolData) {
      return new Response(
        JSON.stringify({ error: "Colegio no encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const loginUrl = "https://app.satescolar.com/login";

    // Build and send email
    const html = buildWelcomeEmailHtml(
      schoolData.name,
      schoolData.logo_url,
      targetEmail,
      newPassword,
      role,
      loginUrl
    );

    const smtpHost = Deno.env.get("SMTP_HOST") ?? "";
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") ?? "587");
    const smtpUser = Deno.env.get("SMTP_USER") ?? "";
    const smtpPass = Deno.env.get("SMTP_PASS") ?? "";
    const fromEmail = Deno.env.get("SMTP_FROM_EMAIL") ?? "";
    const fromName = Deno.env.get("SMTP_FROM_NAME") ?? "SAT Escolar";

    if (!smtpHost || !smtpUser || !smtpPass || !fromEmail) {
      return new Response(
        JSON.stringify({ error: "SMTP no configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
      to: [targetEmail],
      subject: `Bienvenido a ${schoolData.name} - SAT Escolar`,
      headers: {
        "X-Mailin-track": "0",
        "X-Mailgun-Track-Clicks": "no",
        "X-SMTPAPI": '{"filters":{"clicktrack":{"settings":{"enable":0}}}}',
      },
      html,
    });
    await client.close();

    console.log(`Welcome email resent to ${targetEmail}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Correo de bienvenida reenviado a ${targetEmail}. Nueva contraseña generada.`,
        newPassword,
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
