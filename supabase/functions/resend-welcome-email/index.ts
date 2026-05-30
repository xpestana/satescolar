import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendViaSmtp } from "../_shared/smtp-client.ts";
import { buildWelcomeEmailHtml, resolveSnippets, wrapWithEmailLayout } from "../_shared/email-templates.ts";

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
    const templateType = target_type === "teacher" ? "welcome-teacher" : "welcome-family";

    // Check for custom template in DB
    const { data: customTemplate } = await supabaseAdmin
      .from("email_templates")
      .select("subject, body_html, primary_color, text_color")
      .eq("school_id", roleData.school_id)
      .eq("template_type", templateType)
      .eq("is_active", true)
      .maybeSingle();

    let html: string;
    let emailSubject: string;

    if (customTemplate) {
      const snippetData: Record<string, string> = {
        nombre_colegio: schoolData.name,
        email_usuario: targetEmail,
        contrasena: newPassword,
        url_plataforma: loginUrl,
        primary_color: customTemplate.primary_color,
      };
      const resolvedBody = resolveSnippets(customTemplate.body_html, snippetData);
      const resolvedSubject = resolveSnippets(customTemplate.subject, snippetData);
      html = wrapWithEmailLayout(
        resolvedBody,
        customTemplate.primary_color,
        customTemplate.text_color,
        schoolData.name,
        schoolData.logo_url
      );
      emailSubject = resolvedSubject;
    } else {
      html = buildWelcomeEmailHtml(
        schoolData.name,
        schoolData.logo_url,
        targetEmail,
        newPassword,
        role,
        loginUrl
      );
      emailSubject = `Bienvenido a ${schoolData.name} - SAT Escolar`;
    }

    const smtpHost = Deno.env.get("SMTP_HOST") ?? "";
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

    await sendViaSmtp({
      from: `${fromName} <${fromEmail}>`,
      to: [targetEmail],
      subject: emailSubject,
      headers: {
        "X-Mailin-track": "0",
        "X-Mailgun-Track-Clicks": "no",
        "X-SMTPAPI": '{"filters":{"clicktrack":{"settings":{"enable":0}}}}',
      },
      html,
    });

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
