/**
 * Billing emails that SAT Escolar sends to its client schools (pure): the payment reminder
 * (pending months) and the thank-you after a payment is recorded. Same layout as every other
 * platform email, with SAT Escolar's own branding. Used by `client-billing` and by the admin preview.
 */
import { escapeHtml, wrapWithEmailLayout } from "../email/layout.ts";
import { formatMonthLabel, formatMonthList, formatUsd, type MonthKey } from "./billingMonths.ts";

export const SAT_BRANDING = {
  primaryColor: "#1e78c8",
  textColor: "#ffffff",
  schoolName: "SAT Escolar",
  logoUrl: "https://app.satescolar.com/email/sat-escolar-logo-white.png",
  logoOnly: true,
};

export interface BuiltEmail {
  subject: string;
  html: string;
}

const P = "margin:0 0 14px;";

function greeting(contactName: string | null | undefined, schoolName: string): string {
  const name = (contactName ?? "").trim();
  return name ? `Hola, ${escapeHtml(name)}:` : `Estimado equipo de ${escapeHtml(schoolName)}:`;
}

/** Plain text (admin-written) → paragraphs with line breaks, escaped. */
function textToHtml(text: string): string {
  return escapeHtml(text.trim()).replace(/\r?\n/g, "<br>");
}

function monthItems(months: MonthKey[]): string {
  return months
    .map((m) => `<li style="margin:0 0 4px;text-transform:capitalize;">${escapeHtml(formatMonthLabel(m))}</li>`)
    .join("");
}

export interface ReminderEmailInput {
  schoolName: string;
  contactName?: string | null;
  pendingMonths: MonthKey[];
  monthlyFeeUsd?: number | null;
  paymentInstructions?: string | null;
  contactPhone?: string | null;
}

export function buildReminderEmail(input: ReminderEmailInput): BuiltEmail {
  const months = [...input.pendingMonths].sort();
  const count = months.length;
  const fee = input.monthlyFeeUsd != null && input.monthlyFeeUsd > 0 ? Number(input.monthlyFeeUsd) : null;
  const school = escapeHtml(input.schoolName);

  const totalBlock = fee
    ? `<p style="${P}"><strong>Total pendiente:</strong> ${escapeHtml(formatUsd(fee * count))}` +
      (count > 1 ? ` <span style="color:#6b7280;">(${count} meses × ${escapeHtml(formatUsd(fee))})</span>` : "") +
      `</p>`
    : "";

  const instructions = (input.paymentInstructions ?? "").trim();
  const instructionsBlock = instructions
    ? `<div style="margin:0 0 16px;padding:14px 16px;background:#f0f6fc;border-radius:8px;border-left:4px solid #1e78c8;">
<p style="margin:0 0 6px;font-weight:bold;color:#1f2937;">Datos para el pago</p>
<p style="margin:0;">${textToHtml(instructions)}</p></div>`
    : "";

  const phone = (input.contactPhone ?? "").trim();
  const replyLine = phone
    ? `respondiendo a este correo o por WhatsApp al <strong>${escapeHtml(phone)}</strong>`
    : "respondiendo a este correo";

  const body = `<p style="${P}">${greeting(input.contactName, input.schoolName)}</p>
<p style="${P}">Esperamos que estén muy bien. Les escribimos para recordarles amablemente que la mensualidad de
<strong>${school}</strong> en SAT Escolar tiene ${count === 1 ? "pendiente el siguiente mes" : `pendientes los siguientes ${count} meses`}:</p>
<ul style="margin:0 0 16px;padding-left:20px;">${monthItems(months)}</ul>
${totalBlock}
${instructionsBlock}
<p style="${P}">Si ya realizaron el pago, les agradecemos enviarnos el comprobante ${replyLine} para registrarlo cuanto antes. Si tienen alguna duda o necesitan un acuerdo de pago, con gusto lo conversamos.</p>
<p style="${P}">Gracias por confiar en nosotros para la gestión de su institución.</p>
<p style="margin:0;">Un saludo cordial,<br><strong>Equipo SAT Escolar</strong></p>`;

  return {
    subject: `Recordatorio de pago SAT Escolar - ${formatMonthList(months)}`,
    html: wrapWithEmailLayout(body, SAT_BRANDING),
  };
}

export interface ThanksEmailInput {
  schoolName: string;
  contactName?: string | null;
  paidMonths: MonthKey[];
  /** Months still pending after this payment (empty → the account is up to date). */
  remainingMonths?: MonthKey[];
}

export function buildThanksEmail(input: ThanksEmailInput): BuiltEmail {
  const months = [...input.paidMonths].sort();
  const remaining = [...(input.remainingMonths ?? [])].sort();
  const school = escapeHtml(input.schoolName);

  const statusLine = remaining.length
    ? `<p style="${P}color:#6b7280;">Para su control, aún queda${remaining.length === 1 ? "" : "n"} pendiente${remaining.length === 1 ? "" : "s"}: ${escapeHtml(formatMonthList(remaining))}.</p>`
    : `<p style="${P}"><strong>Su cuenta queda al día.</strong></p>`;

  const body = `<p style="${P}">${greeting(input.contactName, input.schoolName)}</p>
<p style="${P}">Hemos recibido y registrado el pago de <strong>${school}</strong> correspondiente a
<strong>${escapeHtml(formatMonthList(months))}</strong>. ¡Muchas gracias!</p>
${statusLine}
<p style="${P}">Queremos agradecerles sinceramente su compromiso y su confianza en SAT Escolar. Cada colegio que camina con nosotros nos impulsa a seguir mejorando, y juntos estamos trabajando para elevar la calidad de la educación en nuestro país.</p>
<p style="${P}">Seguimos a su disposición para acompañarlos en todo lo que necesiten.</p>
<p style="margin:0;">Con gratitud,<br><strong>Equipo SAT Escolar</strong></p>`;

  return {
    subject: `Gracias por su pago - ${formatMonthList(months)}`,
    html: wrapWithEmailLayout(body, SAT_BRANDING),
  };
}
