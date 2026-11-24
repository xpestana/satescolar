/**
 * The one way the platform sends email (Single Responsibility): configuration check, sender,
 * anti-tracking headers, ASCII subject, timeout and error handling. Pure: the SMTP transport is
 * injected, so tests never send real email.
 */

export interface EmailAttachment {
  filename: string;
  /** base64 content */
  content: string;
  contentType: string;
}

export interface OutgoingEmail {
  to: string[];
  bcc?: string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: EmailAttachment[];
}

export interface SendResult {
  sent: boolean;
  error?: string;
}

export interface MailerConfig {
  host: string;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
  timeoutMs?: number;
}

/** What the SMTP client receives (denomailer's SendConfig subset). */
export interface TransportMessage {
  from: string;
  to: string[];
  bcc?: string[];
  subject: string;
  html?: string;
  content?: string;
  headers: Record<string, string>;
  attachments?: { filename: string; content: string; encoding: "base64"; contentType: string }[];
}

export type MailTransport = (message: TransportMessage) => Promise<void>;

const NO_TRACKING_HEADERS: Record<string, string> = {
  "X-Mailin-track": "0",
  "X-Mailgun-Track-Clicks": "no",
  "X-SMTPAPI": '{"filters":{"clicktrack":{"settings":{"enable":0}}}}',
};

const DEFAULT_TIMEOUT_MS = 20_000;

/**
 * Subjects go out as plain ASCII: the shared SMTP client + denomailer double-encode non-ASCII
 * subjects (RFC 2047) and Gmail then shows the raw "=?utf-8?b?...?=" text. Accents are removed
 * and dashes normalized, so "Recordatorio – Rodríguez" becomes "Recordatorio - Rodriguez".
 */
export function asciiSubject(value: string): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/[¿¡]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isMailerConfigured(config: MailerConfig): boolean {
  return !!(config.host && config.user && config.pass && config.fromEmail);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`El servidor de correo no respondió en ${ms / 1000} s`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Removes spaces/tabs at the end of each line. The SMTP client encodes them as quoted-printable
 * "=20" and some clients then show a literal "=20" (e.g. under the logo). HTML does not need them.
 */
export function stripTrailingWhitespace(html: string): string {
  return html.replace(/[ \t]+(?=\r?\n|$)/g, "");
}

export function buildTransportMessage(email: OutgoingEmail, config: MailerConfig): TransportMessage {
  return {
    from: `${config.fromName || "SAT Escolar"} <${config.fromEmail}>`,
    to: email.to,
    ...(email.bcc && email.bcc.length ? { bcc: email.bcc } : {}),
    subject: asciiSubject(email.subject),
    ...(email.html ? { html: stripTrailingWhitespace(email.html) } : { content: email.text ?? "" }),
    headers: { ...NO_TRACKING_HEADERS },
    ...(email.attachments && email.attachments.length
      ? {
        attachments: email.attachments.map((a) => ({
          filename: a.filename,
          content: a.content,
          encoding: "base64" as const,
          contentType: a.contentType,
        })),
      }
      : {}),
  };
}

export interface Mailer {
  isConfigured(): boolean;
  /** Address used as visible `To:` when every real recipient goes in BCC. */
  senderAddress(): string;
  /** Never throws: tells whether the email went out and, if not, why. */
  send(email: OutgoingEmail): Promise<SendResult>;
}

export function createMailer(transport: MailTransport, readConfig: () => MailerConfig): Mailer {
  return {
    isConfigured: () => isMailerConfigured(readConfig()),
    senderAddress: () => readConfig().fromEmail,
    async send(email) {
      const config = readConfig();
      if (!isMailerConfigured(config)) return { sent: false, error: "SMTP no configurado" };
      if (email.to.length === 0 && !(email.bcc?.length)) return { sent: false, error: "Sin destinatarios" };
      try {
        await withTimeout(transport(buildTransportMessage(email, config)), config.timeoutMs ?? DEFAULT_TIMEOUT_MS);
        return { sent: true };
      } catch (e) {
        return { sent: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
  };
}
