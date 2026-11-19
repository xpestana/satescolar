import type { SendConfig } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { sendViaSmtp } from "../smtp-client.ts";
import { createMailer, type MailerConfig } from "./mailerCore.ts";

export type { OutgoingEmail, SendResult } from "./mailerCore.ts";

function readConfig(): MailerConfig {
  return {
    host: Deno.env.get("SMTP_HOST") ?? "",
    user: Deno.env.get("SMTP_USER") ?? "",
    pass: Deno.env.get("SMTP_PASS") ?? "",
    fromEmail: Deno.env.get("SMTP_FROM_EMAIL") ?? "",
    fromName: Deno.env.get("SMTP_FROM_NAME") ?? "SAT Escolar",
  };
}

/** The platform mailer (SMTP / Mailgun). Every Edge Function sends through it. */
export const mailer = createMailer((message) => sendViaSmtp(message as unknown as SendConfig), readConfig);
