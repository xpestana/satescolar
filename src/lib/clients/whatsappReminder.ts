/**
 * WhatsApp shortcut for a billing reminder (pure): normalizes a Venezuelan phone number and builds
 * the wa.me link with a short, friendly message.
 */
import { formatMonthList, formatUsd } from "./billingMonths";

/** "0414-123.45.67" → "584141234567"; "+58 414 1234567" → "584141234567"; invalid → null. */
export function toWhatsAppNumber(phone: string | null | undefined): string | null {
  let digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `58${digits.slice(1)}`;
  else if (digits.length === 10 && digits.startsWith("4")) digits = `58${digits}`;
  return digits.length >= 11 && digits.length <= 15 ? digits : null;
}

export function buildWhatsAppReminderText(input: {
  contactName?: string | null;
  schoolName: string;
  pendingMonths: string[];
  amountDueUsd?: number | null;
}): string {
  const hello = input.contactName?.trim() ? `Hola, ${input.contactName.trim()}` : "Hola";
  const total = input.amountDueUsd ? ` por un total de ${formatUsd(input.amountDueUsd)}` : "";
  return (
    `${hello}, ¿cómo están? Les escribimos de SAT Escolar para recordarles amablemente que la mensualidad de ` +
    `${input.schoolName} tiene pendiente ${formatMonthList(input.pendingMonths)}${total}. ` +
    `Si ya realizaron el pago, por favor envíennos el comprobante por aquí para registrarlo. ¡Muchas gracias!`
  );
}

export function buildWhatsAppLink(phone: string | null | undefined, text: string): string | null {
  const number = toWhatsAppNumber(phone);
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : null;
}
