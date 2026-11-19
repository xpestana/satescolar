import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendViaSmtp } from "./smtp-client.ts";
import {
  buildWelcomeEmail,
  CUSTOM_TEMPLATE_BY_ROLE,
  type CustomEmailTemplate,
  type WelcomeRole,
} from "./welcome-email-content.ts";

export { LOGIN_URL, type WelcomeRole } from "./welcome-email-content.ts";

const SEND_TIMEOUT_MS = 20_000;

/** Contraseña aleatoria sin caracteres ambiguos (0/O, 1/l/I). */
export function generatePassword(length = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join("");
}

/** True when the SMTP secrets needed to send are present. */
export function isSmtpConfigured(): boolean {
  return ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "SMTP_FROM_EMAIL"].every((k) => !!Deno.env.get(k));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`El servidor de correo no respondió en ${ms / 1000} s`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Envía el correo de bienvenida con las credenciales. Usa la plantilla personalizada del colegio
 * (asunto y cuerpo) si existe; si no, la plantilla por defecto.
 * Nunca lanza: devuelve si se envió y, si no, el motivo.
 */
export async function sendWelcomeEmail(
  admin: SupabaseClient,
  opts: {
    schoolId: string | null;
    email: string;
    password: string;
    role: WelcomeRole;
    /** Asunto cuando el colegio no tiene plantilla propia (p. ej. "Nuevas credenciales"). */
    defaultSubject?: string;
  },
): Promise<{ sent: boolean; error?: string }> {
  try {
    if (!isSmtpConfigured()) return { sent: false, error: "SMTP no configurado" };
    const fromEmail = Deno.env.get("SMTP_FROM_EMAIL") ?? "";
    const fromName = Deno.env.get("SMTP_FROM_NAME") ?? "SAT Escolar";

    let schoolName = "SAT Escolar";
    let logoUrl: string | null = null;
    let customTemplate: CustomEmailTemplate | null = null;

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

      const templateType = CUSTOM_TEMPLATE_BY_ROLE[opts.role];
      if (templateType) {
        const { data: custom } = await admin
          .from("email_templates")
          .select("subject, body_html, primary_color, text_color")
          .eq("school_id", opts.schoolId)
          .eq("template_type", templateType)
          .eq("is_active", true)
          .maybeSingle();
        customTemplate = custom ?? null;
      }
    }

    const { subject, html } = buildWelcomeEmail({
      schoolName,
      logoUrl,
      email: opts.email,
      password: opts.password,
      role: opts.role,
      customTemplate,
      defaultSubject: opts.defaultSubject,
    });

    await withTimeout(
      sendViaSmtp({
        from: `${fromName} <${fromEmail}>`,
        to: [opts.email],
        subject,
        headers: {
          "X-Mailin-track": "0",
          "X-Mailgun-Track-Clicks": "no",
          "X-SMTPAPI": '{"filters":{"clicktrack":{"settings":{"enable":0}}}}',
        },
        html,
      }),
      SEND_TIMEOUT_MS,
    );
    console.log(`[welcome-email] enviado a ${opts.email} (${opts.role})`);
    return { sent: true };
  } catch (e) {
    console.error("[welcome-email] fallo el envío:", e);
    return { sent: false, error: e instanceof Error ? e.message : String(e) };
  }
}
