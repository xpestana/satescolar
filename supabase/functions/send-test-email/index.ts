import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCallerRole } from "../_shared/callerRole.ts";
import { mailer } from "../_shared/email/mailer.ts";
import { wrapWithEmailLayout } from "../_shared/email/layout.ts";
import { loadSchoolBranding, renderSchoolEmail } from "../_shared/email/schoolTemplates.ts";
import { EMAIL_TEMPLATES, isEmailTemplateType, type EmailTemplateType } from "../_shared/email/templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type FreeFormType = "custom-html" | "custom-text";

/** Where each template is sent from, shown by /admin/enviar-email after a test. */
const TEMPLATE_SOURCES: Record<EmailTemplateType, { source: string; trigger: string }> = {
  "welcome-family": {
    source: "create-family / resend-welcome-email",
    trigger: "Registro nuevo de familia o reenvío manual desde la lista de familias",
  },
  "welcome-teacher": {
    source: "create-teacher / resend-welcome-email",
    trigger: "Registro nuevo de docente o reenvío manual desde la lista de docentes",
  },
  "welcome-staff": {
    source: "manage-school-subuser / create-admin-user / admin-user-actions",
    trigger: "Alta de un usuario del colegio o del dueño, y restablecimiento de su contraseña",
  },
  delinquency: {
    source: "send-delinquency-reminders",
    trigger: "Cron programado según la configuración de morosidad (diario/semanal/días del mes)",
  },
  "payment-reminder": {
    source: "(sin envío automático todavía)",
    trigger: "Plantilla preparada para recordatorios de cuotas próximas a vencer",
  },
};

const FREE_FORM_TYPES: FreeFormType[] = ["custom-html", "custom-text"];

function freeFormEmail(type: FreeFormType, schoolName: string) {
  if (type === "custom-html") {
    return {
      subject: `[PRUEBA] Comunicado Escolar - ${schoolName}`,
      html: wrapWithEmailLayout(
        `<h2>Comunicado a la Comunidad Escolar</h2>
<p>Estimadas familias y docentes,</p>
<p>Este es un ejemplo de correo HTML enviado desde el módulo de gestión de correos de <strong>SAT Escolar</strong>.</p>
<p>Desde este módulo pueden enviar comunicados, avisos importantes y recordatorios de eventos.</p>`,
        { primaryColor: "#1e78c8", textColor: "#ffffff", schoolName, logoUrl: null },
      ),
      source: "send-email + EmailComposer",
      trigger: "Envío manual desde el módulo de gestión de correos (rol school) o admin",
    };
  }
  return {
    subject: "[PRUEBA] Aviso escolar (texto plano)",
    text: `Estimado/a representante,

Este es un correo de prueba en formato texto plano enviado desde el sistema SAT Escolar.

Institución: ${schoolName}
Fecha: ${new Date().toLocaleDateString("es-VE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}

---
Este es un mensaje automático del sistema de gestión escolar SAT Escolar.`,
    source: "send-email",
    trigger: "Envío manual desde el panel de admin o school con HTML desactivado",
  };
}

/**
 * Sends a sample of a template with sample data. School users test their own school's template
 * (with its real name and logo); the admin may pass `school_id`.
 */
export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No autorizado" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user } } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return json({ error: "No autorizado" }, 401);

    // A user may hold several roles (e.g. school staff who is also a representative).
    const roleData = await getCallerRole(admin, user.id, ["admin", "school"]);
    if (!roleData) return json({ error: "No autorizado para usar esta función" }, 403);

    const { to, email_type, school_id: requestedSchoolId } = await req.json();
    const schoolId: string | null = roleData.role === "school" ? roleData.school_id : (requestedSchoolId ?? null);

    if (!to || typeof to !== "string" || !to.includes("@")) return json({ error: "Correo destino inválido" }, 400);
    const validTypes = [...Object.keys(EMAIL_TEMPLATES), ...FREE_FORM_TYPES];
    if (!validTypes.includes(email_type)) {
      return json({ error: `Tipo inválido. Valores permitidos: ${validTypes.join(", ")}` }, 400);
    }
    if (!mailer.isConfigured()) {
      return json({ error: "SMTP no configurado. Verifique SMTP_HOST, SMTP_USER, SMTP_PASS y SMTP_FROM_EMAIL." }, 503);
    }

    const branding = await loadSchoolBranding(admin, schoolId);
    const schoolName = schoolId ? branding.name : "Colegio Demo SAT";

    let subject: string;
    let html: string | undefined;
    let text: string | undefined;
    let source: string;
    let trigger: string;

    if (isEmailTemplateType(email_type)) {
      const sample = { ...EMAIL_TEMPLATES[email_type].sample, nombre_colegio: schoolName };
      const rendered = await renderSchoolEmail(admin, schoolId, email_type, sample, {
        branding: { ...branding, name: schoolName },
      });
      subject = `[PRUEBA] ${rendered.subject}`;
      html = rendered.html;
      ({ source, trigger } = TEMPLATE_SOURCES[email_type]);
    } else {
      const sample = freeFormEmail(email_type as FreeFormType, schoolName);
      ({ subject, source, trigger } = sample);
      html = "html" in sample ? sample.html : undefined;
      text = "text" in sample ? sample.text : undefined;
    }

    const result = await mailer.send({ to: [to.trim()], subject, html, text });
    if (!result.sent) return json({ error: `No se pudo enviar el correo de prueba: ${result.error}` }, 502);

    return json({
      success: true,
      message: `Correo de prueba enviado a ${to}`,
      subject,
      source,
      trigger,
      smtp_from: `${Deno.env.get("SMTP_FROM_NAME") ?? "SAT Escolar"} <${mailer.senderAddress()}>`,
    });
  } catch (error) {
    console.error("[send-test-email] error:", error);
    return json({ error: error instanceof Error ? error.message : "Error interno del servidor" }, 500);
  }
}

if (import.meta.main) Deno.serve(handler);
