import type { ReceiptSkipReason } from "@/hooks/payroll/usePayrollPayments";

/** What to tell the user about the receipt email after a payment is marked paid. */
export function receiptNotice(emailSent: boolean, reason: ReceiptSkipReason | null): string {
  if (emailSent) return "Se envió el recibo por correo.";
  if (reason === "no-email") return "No tiene correo registrado, así que no se envió el recibo.";
  return "No se pudo enviar el recibo por correo.";
}
