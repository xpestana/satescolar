import { supabase } from "@/integrations/supabase/client";

/**
 * Exoneración de una cuota: el colegio decide que el estudiante NO va a pagar ese concepto.
 * Se marca al registrar el pago (junto al descuento) y cierra el saldo de la cuota sin
 * generar ingreso.
 *
 * Diferencia con el descuento ad-hoc: el descuento rebaja lo que se cobra en esa factura;
 * la exoneración perdona el pendiente completo y no cuelga de una línea de pago.
 */

/** Fila de `student_concept_balances` con lo mínimo para exonerar y revertir. */
export interface ExonerableBalance {
  id: string;
  school_id: string;
  school_year_id: string;
  student_id: string;
  plan_concept_id: string;
  currency?: string | null;
  exchange_rate_snapshot?: number | null;
  total_amount?: number | null;
  paid_amount?: number | null;
  balance?: number | null;
}

export interface ConceptExoneration {
  id: string;
  school_id: string;
  school_year_id: string;
  student_id: string;
  balance_id: string;
  plan_concept_id: string;
  payment_id: string | null;
  amount_ves: number;
  original_amount: number | null;
  currency: string;
  exchange_rate: number;
  reason: string;
  created_by: string | null;
  created_at: string;
  reverted_at: string | null;
  reverted_by: string | null;
}

/** Lo que exonera una cuota, tal como se captura en la UI antes de guardarse. */
export interface ExonerationDraft {
  reason: string;
}

/** Pendiente de la cuota en VES: es exactamente lo que se perdona. */
export const exonerablePendingVes = (balance: ExonerableBalance) => Math.max(0, Number(balance.balance) || 0);

/**
 * Registra la exoneración y cierra el saldo de la cuota.
 * El ledger conserva `paid_amount + balance = total_amount`: lo exonerado se suma a
 * `paid_amount` (no es dinero — el dashboard y el estado de cuenta lo restan de lo cobrado).
 */
export async function applyConceptExoneration(params: {
  balance: ExonerableBalance;
  reason: string;
  userId?: string | null;
  paymentId?: string | null;
}): Promise<void> {
  const { balance, userId = null, paymentId = null } = params;
  const reason = params.reason.trim();
  if (!reason) throw new Error("El motivo de la exoneración es obligatorio");

  const pendingVes = exonerablePendingVes(balance);
  if (pendingVes <= 0) throw new Error("Esta cuota no tiene saldo pendiente por exonerar");

  const currency = balance.currency || "VES";
  const snapshot = Number(balance.exchange_rate_snapshot) || 1;
  const pendingOriginal = currency === "VES" ? pendingVes : pendingVes / snapshot;

  const { error: insErr } = await supabase.from("concept_exonerations").insert({
    school_id: balance.school_id,
    school_year_id: balance.school_year_id,
    student_id: balance.student_id,
    balance_id: balance.id,
    plan_concept_id: balance.plan_concept_id,
    payment_id: paymentId,
    amount_ves: parseFloat(pendingVes.toFixed(2)),
    original_amount: currency === "VES" ? null : parseFloat(pendingOriginal.toFixed(4)),
    currency,
    exchange_rate: snapshot,
    reason,
    created_by: userId,
  });
  if (insErr) throw insErr;

  const { error: balErr } = await supabase.from("student_concept_balances").update({
    paid_amount: parseFloat(((Number(balance.paid_amount) || 0) + pendingVes).toFixed(2)),
    balance: 0,
    status: "exonerated",
  }).eq("id", balance.id);
  if (balErr) throw balErr;
}

/**
 * Deshace una exoneración: devuelve el pendiente exonerado a la cuota. La fila no se borra,
 * se marca `reverted_at`/`reverted_by` para conservar la auditoría.
 */
export async function revertConceptExoneration(params: {
  exoneration: ConceptExoneration;
  balance: ExonerableBalance;
  userId?: string | null;
}): Promise<void> {
  const { exoneration, balance, userId = null } = params;
  const restored = Number(exoneration.amount_ves) || 0;
  const newPaid = Math.max(0, (Number(balance.paid_amount) || 0) - restored);
  const total = Number(balance.total_amount) || 0;
  const newBalance = parseFloat(Math.max(0, total - newPaid).toFixed(2));

  const { error: balErr } = await supabase.from("student_concept_balances").update({
    paid_amount: parseFloat(newPaid.toFixed(2)),
    balance: newBalance,
    status: newPaid <= 0 ? "pending" : (newBalance <= 0 ? "paid" : "partial"),
  }).eq("id", balance.id);
  if (balErr) throw balErr;

  const { error: exErr } = await supabase.from("concept_exonerations").update({
    reverted_at: new Date().toISOString(),
    reverted_by: userId,
  }).eq("id", exoneration.id);
  if (exErr) throw exErr;
}
