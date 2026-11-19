import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mailer } from "./email/mailer.ts";
import { loadEmailTemplate, renderSchoolEmail } from "./email/schoolTemplates.ts";
import { buildWelcomeVariables, WELCOME_TEMPLATE_BY_ROLE, type WelcomeRole } from "./email/welcome.ts";

export { type WelcomeRole } from "./email/welcome.ts";
export { LOGIN_URL } from "./email/templates.ts";

/** Contraseña aleatoria sin caracteres ambiguos (0/O, 1/l/I). */
export function generatePassword(length = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join("");
}

/** True when the SMTP secrets needed to send are present. */
export function isSmtpConfigured(): boolean {
  return mailer.isConfigured();
}

/**
 * Envía el correo de bienvenida con las credenciales, con la plantilla editable del colegio para
 * ese rol (asunto y cuerpo) o la por defecto. Nunca lanza: devuelve si se envió y, si no, el motivo.
 */
export async function sendWelcomeEmail(
  admin: SupabaseClient,
  opts: {
    schoolId: string | null;
    email: string;
    password: string;
    role: WelcomeRole;
    fullName?: string | null;
    /** Asunto cuando el colegio no personalizó la plantilla (p. ej. "Nuevas credenciales"). */
    defaultSubject?: string;
  },
): Promise<{ sent: boolean; error?: string }> {
  try {
    const type = WELCOME_TEMPLATE_BY_ROLE[opts.role];
    const { template, isCustom } = await loadEmailTemplate(admin, opts.schoolId, type);
    const effective = !isCustom && opts.defaultSubject ? { ...template, subject: opts.defaultSubject } : template;
    const { subject, html } = await renderSchoolEmail(admin, opts.schoolId, type, buildWelcomeVariables(opts), {
      template: effective,
    });

    const result = await mailer.send({ to: [opts.email], subject, html });
    if (result.sent) console.log(`[welcome-email] enviado a ${opts.email} (${opts.role})`);
    else console.error(`[welcome-email] no enviado a ${opts.email}:`, result.error);
    return result;
  } catch (e) {
    console.error("[welcome-email] fallo al preparar el correo:", e);
    return { sent: false, error: e instanceof Error ? e.message : String(e) };
  }
}
