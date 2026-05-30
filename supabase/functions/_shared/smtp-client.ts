/**
 * SMTP (denomailer) alineado con Mailgun / proveedores estándar:
 * - Puerto 587/2525: conexión en claro + STARTTLS (`tls: false`).
 * - Puerto 465: TLS implícito (`tls: true`) — suele evitar errores denomailer/Deno en `Deno.startTls` (ej. Mailgun).
 *
 * `SMTP_TLS_MODE`: auto | starttls | implicit | plain
 */
import type { ClientOptions, SendConfig } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

function parsePort(): number {
  const raw = Deno.env.get("SMTP_PORT") ?? "587";
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : 587;
}

export type SmtpTlsMode = "starttls" | "implicit" | "plain";

export function resolveSmtpTlsMode(port: number): SmtpTlsMode {
  const v = (Deno.env.get("SMTP_TLS_MODE") ?? "").trim().toLowerCase();
  if (!v || v === "auto") {
    return port === 465 ? "implicit" : "starttls";
  }
  if (v === "starttls") return "starttls";
  if (v === "implicit" || v === "smtps" || v === "ssl") return "implicit";
  if (v === "plain" || v === "none") return "plain";
  console.warn(`[smtp-client] SMTP_TLS_MODE desconocido "${v}", usando auto`);
  return port === 465 ? "implicit" : "starttls";
}

export function buildSmtpClientOptions(): ClientOptions {
  const hostname = Deno.env.get("SMTP_HOST") ?? "";
  const port = parsePort();
  const username = Deno.env.get("SMTP_USER") ?? "";
  const password = Deno.env.get("SMTP_PASS") ?? "";
  const mode = resolveSmtpTlsMode(port);

  const tls = mode === "implicit";
  const noStartTLS = mode === "plain";

  return {
    connection: {
      hostname,
      port,
      tls,
      auth: { username, password },
    },
    debug: {
      noStartTLS,
    },
  };
}

export function createSmtpClient(): SMTPClient {
  return new SMTPClient(buildSmtpClientOptions());
}

async function safeClose(client: SMTPClient): Promise<void> {
  try {
    await client.close();
  } catch {
    /* conexión rota después de error TLS handshake */
  }
}

/**
 * Envía corrreo cerrando cliente; si Mailgun en 587/STARTTLS falla con errores conocidos en Deno,
 * reintenta una vez por smtp.mailgun.org:465 (TLS implícito), que suele funcionar mejor.
 */
export async function sendViaSmtp(mail: SendConfig): Promise<void> {
  const hostname = Deno.env.get("SMTP_HOST") ?? "";
  const username = Deno.env.get("SMTP_USER") ?? "";
  const password = Deno.env.get("SMTP_PASS") ?? "";
  const envPort = parsePort();
  const mode = resolveSmtpTlsMode(envPort);

  const client = new SMTPClient(buildSmtpClientOptions());
  try {
    await client.send(mail);
    await client.close();
    return;
  } catch (e) {
    const msg = String((e instanceof Error ? e.message : e) ?? e);
    const host = hostname.toLowerCase();
    const isMailgun = host.includes("mailgun.");
    /** Errores típicos cuando STARTTLS falla sobre denomailer 1.x + Deno Edge */
    const likelyStartTlsFailure =
      /\bBadResource\b/i.test(msg) ||
      /\bSTARTTLS\b/i.test(msg) ||
      /startTls/i.test(msg) ||
      /\binvalid cmd\b/i.test(msg);

    if (
      !(isMailgun && envPort === 587 && mode === "starttls" && likelyStartTlsFailure)
    ) {
      await safeClose(client);
      throw e;
    }

    console.warn("[smtp-client] Fallback Mailgun 465 TLS implícito tras error en STARTTLS:", msg);
    await safeClose(client);

    const fb = new SMTPClient({
      connection: {
        hostname,
        port: 465,
        tls: true,
        auth: { username, password },
      },
      debug: { noStartTLS: false },
    });
    try {
      await fb.send(mail);
    } finally {
      await fb.close().catch(() => {});
    }
  }
}
