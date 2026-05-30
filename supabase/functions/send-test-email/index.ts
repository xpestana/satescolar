import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendViaSmtp } from "../_shared/smtp-client.ts";
import { buildWelcomeEmailHtml, buildDelinquencyEmailHtml, resolveSnippets, wrapWithEmailLayout } from "../_shared/email-templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLATFORM_URL = "https://app.satescolar.com/login";

type EmailType = "welcome-family" | "welcome-teacher" | "delinquency" | "custom-html" | "custom-text";

interface TestEmailMeta {
  subject: string;
  html?: string;
  text?: string;
  previewData: Record<string, unknown>;
  source: string;
  trigger: string;
}

function buildTestEmail(type: EmailType): TestEmailMeta {
  switch (type) {
    case "welcome-family":
      return {
        subject: "[PRUEBA] Bienvenido/a a Colegio Demo SAT - SAT Escolar",
        html: buildWelcomeEmailHtml(
          "Colegio Demo SAT",
          null,
          "maria.perez@demo.com",
          "Demo1234",
          "representante",
          PLATFORM_URL
        ),
        previewData: {
          schoolName: "Colegio Demo SAT",
          email: "maria.perez@demo.com",
          password: "Demo1234",
          role: "representante",
        },
        source: "create-family / resend-welcome-email",
        trigger: "Registro nuevo de familia o reenvío manual desde la lista de familias",
      };

    case "welcome-teacher":
      return {
        subject: "[PRUEBA] Bienvenido/a a Colegio Demo SAT - SAT Escolar",
        html: buildWelcomeEmailHtml(
          "Colegio Demo SAT",
          null,
          "pedro.gomez@demo.com",
          "12345678",
          "docente",
          PLATFORM_URL
        ),
        previewData: {
          schoolName: "Colegio Demo SAT",
          email: "pedro.gomez@demo.com",
          password: "12345678",
          role: "docente",
        },
        source: "create-teacher / resend-welcome-email",
        trigger: "Registro nuevo de docente o reenvío manual desde la lista de docentes",
      };

    case "delinquency":
      return {
        subject: "[PRUEBA] Recordatorio de Pago Pendiente - Carlos Rodríguez",
        html: buildDelinquencyEmailHtml(
          "Colegio Demo SAT",
          "Carlos Rodríguez",
          "5to Grado",
          "Sección A",
          [
            { name: "Mensualidad Enero 2025", balance: 150 },
            { name: "Mensualidad Febrero 2025", balance: 150 },
            { name: "Inscripción Anual", balance: 200 },
          ],
          500,
          "0412-0000000",
          "contacto@colegiodemo.edu.ve"
        ),
        previewData: {
          student: "Carlos Rodríguez",
          grade: "5to Grado - Sección A",
          concepts: ["Mensualidad Enero 2025: 150 VES", "Mensualidad Febrero 2025: 150 VES", "Inscripción Anual: 200 VES"],
          total: "500 VES",
          schoolPhone: "0412-0000000",
          schoolEmail: "contacto@colegiodemo.edu.ve",
        },
        source: "send-delinquency-reminders",
        trigger: "Cron programado según configuración de morosidad (diario/semanal/días del mes)",
      };

    case "custom-html":
      return {
        subject: "[PRUEBA] Comunicado Escolar - Colegio Demo SAT",
        html: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:32px 0;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <tr><td style="padding:0;background:linear-gradient(135deg,#1e78c8,#0d4f8c);height:8px;"></td></tr>
  <tr><td style="padding:32px 32px 8px;border-bottom:1px solid #e8e8ed;background:#f8f9fc;">
    <h2 style="margin:0;font-size:20px;color:#1a1a2e;">Colegio Demo SAT</h2>
  </td></tr>
  <tr><td style="padding:32px 32px 24px;">
    <h1 style="margin:0 0 16px;font-size:22px;color:#1a1a2e;">Comunicado a la Comunidad Escolar</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4a4a5a;">
      Estimadas familias y docentes,<br/><br/>
      Este es un ejemplo de correo HTML personalizado enviado desde el módulo de gestión de correos de <strong>SAT Escolar</strong>.
    </p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4a4a5a;">
      Desde este módulo pueden enviar comunicados, avisos importantes, recordatorios de eventos y cualquier información relevante para la comunidad del colegio.
    </p>
    <div style="background:#f0f4ff;border-radius:8px;padding:16px 20px;margin:16px 0;">
      <p style="margin:0;font-size:14px;color:#1e78c8;font-weight:bold;">💡 Este correo es solo una prueba del sistema</p>
      <p style="margin:8px 0 0;font-size:14px;color:#4a4a5a;">Los correos reales pueden incluir formato enriquecido, imágenes y los colores de su institución.</p>
    </div>
  </td></tr>
  <tr><td align="center" style="padding:20px 24px;background-color:#f8f9fc;border-top:1px solid #e8e8ed;">
    <p style="margin:0 0 4px;font-size:13px;font-weight:bold;color:#6b7280;">SAT ESCOLAR</p>
    <a href="https://satescolar.com" target="_blank" style="font-size:13px;color:#1e78c8;text-decoration:none;">satescolar.com</a>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
        previewData: {
          type: "HTML personalizado",
          description: "Comunicado de ejemplo con formato enriquecido",
        },
        source: "send-email + EmailComposer",
        trigger: "Envío manual desde el módulo de gestión de correos (rol school) o admin",
      };

    case "custom-text":
      return {
        subject: "[PRUEBA] Aviso escolar (texto plano)",
        text: `Estimado/a representante,

Le informamos que este es un correo de prueba en formato texto plano enviado desde el sistema SAT Escolar.

Los correos en texto plano son útiles para garantizar compatibilidad con todos los clientes de correo.

Institución: Colegio Demo SAT
Fecha: ${new Date().toLocaleDateString("es-VE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}

Para más información visite: https://satescolar.com

---
Este es un mensaje automático del sistema de gestión escolar SAT Escolar.`,
        previewData: {
          type: "Texto plano",
          description: "Aviso de ejemplo sin formato HTML",
        },
        source: "send-email",
        trigger: "Envío manual desde el panel de admin o school con HTML desactivado",
      };

    case "payment-reminder":
      return {
        subject: "[PRUEBA] Recordatorio de Cuota - Carlos Rodríguez",
        html: buildDelinquencyEmailHtml(
          "Colegio Demo SAT",
          "Carlos Rodríguez",
          "5to Grado",
          "Sección A",
          [{ name: "Mensualidad Marzo 2025", balance: 150 }],
          150,
          "0412-0000000",
          "contacto@colegiodemo.edu.ve"
        ),
        previewData: {
          student: "Carlos Rodríguez",
          grade: "5to Grado - Sección A",
          concepts: ["Mensualidad Marzo 2025: 150 VES"],
          total: "150 VES",
        },
        source: "payment-reminder (trigger futuro)",
        trigger: "Template configurable para recordatorio de cuotas próximas a vencer",
      };

    default:
      throw new Error(`Tipo de correo desconocido: ${type}`);
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub as string;
    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role, school_id")
      .eq("user_id", userId)
      .single();

    if (!roleData || !["admin", "school"].includes(roleData.role)) {
      return new Response(
        JSON.stringify({ error: "No autorizado para usar esta función" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { to, email_type, school_id: requestedSchoolId } = await req.json();

    // School users can only test their own school's templates
    const resolvedSchoolId: string | null =
      roleData.role === "school"
        ? roleData.school_id
        : (requestedSchoolId ?? null);

    if (!to || typeof to !== "string" || !to.includes("@")) {
      return new Response(
        JSON.stringify({ error: "Correo destino inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validTypes: EmailType[] = ["welcome-family", "welcome-teacher", "delinquency", "custom-html", "custom-text", "payment-reminder"];
    if (!email_type || !validTypes.includes(email_type)) {
      return new Response(
        JSON.stringify({ error: `Tipo inválido. Valores permitidos: ${validTypes.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const smtpHost = Deno.env.get("SMTP_HOST") ?? "";
    const smtpUser = Deno.env.get("SMTP_USER") ?? "";
    const smtpPass = Deno.env.get("SMTP_PASS") ?? "";
    const fromEmail = Deno.env.get("SMTP_FROM_EMAIL") ?? "";
    const fromName = Deno.env.get("SMTP_FROM_NAME") ?? "SAT Escolar";

    if (!smtpHost || !smtpUser || !smtpPass || !fromEmail) {
      return new Response(
        JSON.stringify({ error: "SMTP no configurado. Verifique las variables SMTP_HOST, SMTP_USER, SMTP_PASS y SMTP_FROM_EMAIL." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for custom template if school_id provided and type is customizable
    const customizableTypes = ["welcome-family", "welcome-teacher", "delinquency", "payment-reminder"];
    let customHtml: string | null = null;
    let customSubject: string | null = null;

    if (resolvedSchoolId && customizableTypes.includes(email_type)) {
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
      const { data: ct } = await supabaseAdmin
        .from("email_templates")
        .select("subject, body_html, primary_color, text_color")
        .eq("school_id", resolvedSchoolId)
        .eq("template_type", email_type)
        .eq("is_active", true)
        .maybeSingle();

      if (ct) {
        const { data: schoolRec } = await supabaseAdmin
          .from("schools")
          .select("name, logo_url")
          .eq("id", resolvedSchoolId)
          .maybeSingle();

        const dummyMap: Record<string, Record<string, string>> = {
          "welcome-family": { nombre_colegio: "Colegio Demo SAT", email_usuario: "maria.perez@demo.com", contrasena: "Demo1234", url_plataforma: "https://app.satescolar.com/login" },
          "welcome-teacher": { nombre_colegio: "Colegio Demo SAT", email_usuario: "pedro.gomez@demo.com", contrasena: "12345678", url_plataforma: "https://app.satescolar.com/login" },
          delinquency: { nombre_colegio: "Colegio Demo SAT", nombre_estudiante: "Carlos Rodríguez", grado_seccion: "5to Grado - Sección A", conceptos_pendientes: "<ul><li>Mensualidad Enero: <strong>150,00 VES</strong></li><li>Inscripción: <strong>200,00 VES</strong></li></ul>", total_adeudado: "350,00 VES", telefono_colegio: "0412-0000000", email_colegio: "contacto@demo.edu.ve" },
          "payment-reminder": { nombre_colegio: "Colegio Demo SAT", nombre_estudiante: "Carlos Rodríguez", grado_seccion: "5to Grado - Sección A", conceptos_pendientes: "<ul><li>Mensualidad Marzo: <strong>150,00 VES</strong></li></ul>", total_adeudado: "150,00 VES", telefono_colegio: "0412-0000000", email_colegio: "contacto@demo.edu.ve" },
        };

        const dummy = { ...(dummyMap[email_type] ?? {}), primary_color: ct.primary_color };
        customHtml = wrapWithEmailLayout(
          resolveSnippets(ct.body_html, dummy),
          ct.primary_color,
          ct.text_color,
          schoolRec?.name ?? "Colegio Demo SAT",
          schoolRec?.logo_url ?? null
        );
        customSubject = `[PRUEBA] ${resolveSnippets(ct.subject, dummy)}`;
      }
    }

    const testEmail = buildTestEmail(email_type as EmailType);
    const finalSubject = customSubject ?? testEmail.subject;
    const finalHtml = customHtml ?? testEmail.html;
    const finalText = testEmail.text;

    await sendViaSmtp({
      from: `${fromName} <${fromEmail}>`,
      to: [to.trim()],
      subject: finalSubject,
      ...(finalHtml ? { html: finalHtml } : { content: finalText ?? "" }),
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Correo de prueba enviado a ${to}`,
        subject: testEmail.subject,
        preview_data: testEmail.previewData,
        source: testEmail.source,
        trigger: testEmail.trigger,
        smtp_from: `${fromName} <${fromEmail}>`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[send-test-email] error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Error interno del servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

if (import.meta.main) Deno.serve(handler);
