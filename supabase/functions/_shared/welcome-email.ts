import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendViaSmtp } from "./smtp-client.ts";
import { buildWelcomeEmailHtml, resolveSnippets, wrapWithEmailLayout } from "./email-templates.ts";

export const LOGIN_URL = "https://app.satescolar.com/login";

export type WelcomeRole = "representante" | "docente" | "administrador";

/** Contraseña aleatoria sin caracteres ambiguos (0/O, 1/l/I). */
export function generatePassword(length = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join("");
}

const CUSTOM_TEMPLATE_BY_ROLE: Partial<Record<WelcomeRole, string>> = {
  docente: "welcome-teacher",
  representante: "welcome-family",
};

/**
 * Envía el correo de bienvenida con las credenciales. Usa la plantilla personalizada del colegio
 * si existe (docentes y representantes); si no, la plantilla por defecto.
 * Nunca lanza: devuelve si se envió y, si no, el motivo.
 */
export async function sendWelcomeEmail(
  admin: SupabaseClient,
  opts: { schoolId: string | null; email: string; password: string; role: WelcomeRole },
): Promise<{ sent: boolean; error?: string }> {
  try {
    const host = Deno.env.get("SMTP_HOST") ?? "";
    const user = Deno.env.get("SMTP_USER") ?? "";
    const pass = Deno.env.get("SMTP_PASS") ?? "";
    const fromEmail = Deno.env.get("SMTP_FROM_EMAIL") ?? "";
    const fromName = Deno.env.get("SMTP_FROM_NAME") ?? "SAT Escolar";
    if (!host || !user || !pass || !fromEmail) return { sent: false, error: "SMTP no configurado" };

    let schoolName = "SAT Escolar";
    let logoUrl: string | null = null;
    if (opts.schoolId) {
      const { data: school } = await admin
        .from("schools")
        .select("name, logo_url")
        .eq("id", opts.schoolId)
        .maybeSingle();
      if (school) {
        schoolName = school.name;
        logoUrl = school.logo_url ?? null;
      }
    }

    let html: string | null = null;
    let subject = `Bienvenido a ${schoolName} - SAT Escolar`;

    const templateType = CUSTOM_TEMPLATE_BY_ROLE[opts.role];
    if (templateType && opts.schoolId) {
      const { data: custom } = await admin
        .from("email_templates")
        .select("subject, body_html, primary_color, text_color")
        .eq("school_id", opts.schoolId)
        .eq("template_type", templateType)
        .eq("is_active", true)
        .maybeSingle();
      if (custom) {
        const snippets: Record<string, string> = {
          nombre_colegio: schoolName,
          email_usuario: opts.email,
          contrasena: opts.password,
          url_plataforma: LOGIN_URL,
          primary_color: custom.primary_color,
        };
        html = wrapWithEmailLayout(
          resolveSnippets(custom.body_html, snippets),
          custom.primary_color,
          custom.text_color,
          schoolName,
          logoUrl,
        );
        subject = resolveSnippets(custom.subject, snippets);
      }
    }

    html ??= buildWelcomeEmailHtml(schoolName, logoUrl, opts.email, opts.password, opts.role, LOGIN_URL);

    await sendViaSmtp({
      from: `${fromName} <${fromEmail}>`,
      to: [opts.email],
      subject,
      headers: {
        "X-Mailin-track": "0",
        "X-Mailgun-Track-Clicks": "no",
        "X-SMTPAPI": '{"filters":{"clicktrack":{"settings":{"enable":0}}}}',
      },
      html,
    });
    console.log(`[welcome-email] enviado a ${opts.email} (${opts.role})`);
    return { sent: true };
  } catch (e) {
    console.error("[welcome-email] fallo el envío:", e);
    return { sent: false, error: e instanceof Error ? e.message : String(e) };
  }
}
