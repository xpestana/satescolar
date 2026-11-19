import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mailer } from "../_shared/email/mailer.ts";
import { isSchoolModuleActive } from "../_shared/schoolModules.ts";
import { getCallerRole } from "../_shared/callerRole.ts";
import { hasSchoolPermission } from "../_shared/schoolPermissions.ts";
import { buildBulkEnvelopes, parseRecipients } from "../_shared/bulkRecipients.ts";

// Prevent SMTP/TLS internal errors from crashing the edge worker.
if (typeof addEventListener === "function") {
  addEventListener("unhandledrejection", (e: any) => {
    console.error("[send-email] unhandledrejection swallowed:", e?.reason ?? e);
    e?.preventDefault?.();
  });
  addEventListener("error", (e: any) => {
    console.error("[send-email] uncaught error swallowed:", e?.error ?? e?.message ?? e);
    e?.preventDefault?.();
  });
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/**
 * Free-form email from the platform admin (/admin/enviar-email) or from school staff with the
 * `emails.send` permission (/utilidades/correo). Several recipients go in BCC, in batches.
 */
export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No autorizado" }, 401);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return json({ error: "Sesión inválida" }, 401);

    const callerRole = await getCallerRole(supabaseAdmin, user.id, ["admin", "school"]);
    if (!callerRole) return json({ error: "Solo el administrador o el personal del colegio pueden enviar correos" }, 403);

    // Admins are never gated. School staff need the messaging module and the emails.send permission.
    if (callerRole.role === "school") {
      if (!callerRole.school_id) return json({ error: "Su usuario no está asociado a un colegio" }, 403);
      if (!(await isSchoolModuleActive(supabaseAdmin, callerRole.school_id, "messaging"))) {
        return json({
          error: "El módulo de Mensajes Masivos no está activo en este colegio",
          status: "module_inactive",
        }, 403);
      }
      const allowed = await hasSchoolPermission(supabaseAdmin, {
        userId: user.id,
        schoolId: callerRole.school_id,
        isOwner: !!callerRole.is_owner,
        permission: "emails.send",
      });
      if (!allowed) return json({ error: "No tiene permiso para enviar correos" }, 403);
    }

    const { to, subject, body, isHtml } = await req.json();
    if (!to || !subject || !body) return json({ error: "Destinatarios, asunto y mensaje son obligatorios" }, 400);

    const { valid: recipients, invalid } = parseRecipients(to);
    if (recipients.length === 0) {
      return json({ error: `No hay destinatarios válidos${invalid.length ? `: ${invalid.join(", ")}` : ""}` }, 400);
    }

    if (!mailer.isConfigured()) {
      return json({ error: "El envío de correos no está configurado en el servidor" }, 503);
    }

    let sent = 0;
    const failed: string[] = [];
    let lastError = "";

    for (const envelope of buildBulkEnvelopes(recipients, mailer.senderAddress())) {
      const batch = envelope.bcc ?? envelope.to;
      const result = await mailer.send({
        to: envelope.to,
        bcc: envelope.bcc,
        subject,
        ...(isHtml ? { html: body } : { text: body }),
      });
      if (result.sent) {
        sent += batch.length;
      } else {
        lastError = result.error ?? "";
        console.error("[send-email] batch failed:", result.error);
        failed.push(...batch);
      }
    }

    if (sent === 0) return json({ error: `No se pudo enviar el correo: ${lastError || "error desconocido"}`, failed }, 502);

    const notes = [
      failed.length ? `${failed.length} no se pudieron enviar` : "",
      invalid.length ? `${invalid.length} direcciones inválidas omitidas` : "",
    ].filter(Boolean);

    return json({
      success: true,
      sent,
      failed,
      invalid,
      message: `Email enviado a ${sent} destinatario(s)${notes.length ? ` (${notes.join("; ")})` : ""}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error sending email:", error);
    return json({ error: message || "Error al enviar email" }, 500);
  }
}

if (import.meta.main) Deno.serve(handler);
