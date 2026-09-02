/**
 * Descuento ad-hoc por cuota, aplicado al registrar un pago.
 *
 * Es independiente del descuento del plan (`payment_plan_concepts.discount_type/discount_value`,
 * ya incorporado al saldo). Este solo afecta al pago que se está registrando y **cierra la cuota**:
 *
 *     cuota saldada = efectivo cobrado + descuento concedido
 *
 * El efectivo (`payment_items.amount_ves`) nunca incluye el descuento, de modo que los reportes
 * de ingresos siguen cuadrando con `payments.total_amount_ves`.
 */

export type AdHocDiscountType = "none" | "fixed" | "percentage";

/** Descuento tal como lo captura el usuario en el modal (estado de UI). */
export interface AdHocDiscountDraft {
  type: AdHocDiscountType;
  /** `fixed`: monto en la MONEDA DEL CONCEPTO. `percentage`: 0..100 del pendiente. */
  value: string;
  reason: string;
}

export interface DiscountComputationInput {
  type: AdHocDiscountType;
  value: number;
  /** Pendiente de la cuota en su moneda original. */
  pendingOriginal: number;
  /** Tasa moneda del concepto → VES (1 si el concepto es en VES). */
  rate: number;
}

export interface DiscountComputation {
  /** Descuento efectivo en la moneda del concepto, ya topado al pendiente. */
  discountOriginal: number;
  /** El mismo descuento en VES, a `rate`. */
  discountVes: number;
  /** Efectivo que queda por cobrar tras el descuento. */
  amountToPayOriginal: number;
  amountToPayVes: number;
  /** true si el valor pedido excedía el pendiente y se topó. */
  clamped: boolean;
}

/** Redondeos alineados con el resto del módulo de pagos. */
export const VES_DECIMALS = 2;
export const ORIGINAL_DECIMALS = 4;
/** Margen con el que se considera saldada una cuota. */
export const SETTLEMENT_EPSILON_VES = 0.01;

export const ZERO_DISCOUNT: DiscountComputation = {
  discountOriginal: 0,
  discountVes: 0,
  amountToPayOriginal: 0,
  amountToPayVes: 0,
  clamped: false,
};

const round = (n: number, decimals: number) => parseFloat(n.toFixed(decimals));

/** Descuento y monto a cobrar resultantes para una cuota. */
export function computeAdHocDiscount(input: DiscountComputationInput): DiscountComputation {
  const pendingOriginal = Math.max(0, Number(input.pendingOriginal) || 0);
  const rate = Number(input.rate) || 1;
  const pendingVes = round(pendingOriginal * rate, VES_DECIMALS);
  const value = Number(input.value) || 0;

  let requested = 0;
  if (input.type === "percentage") {
    const pct = Math.min(Math.max(value, 0), 100);
    requested = (pendingOriginal * pct) / 100;
  } else if (input.type === "fixed") {
    requested = Math.max(value, 0);
  }

  const discountOriginal = round(Math.min(requested, pendingOriginal), ORIGINAL_DECIMALS);
  const discountVes = round(discountOriginal * rate, VES_DECIMALS);
  // El monto a cobrar se calcula por resta del pendiente para que efectivo + descuento
  // reconstruyan exactamente la cuota, sin arrastrar céntimos de redondeo.
  const amountToPayVes = Math.max(0, round(pendingVes - discountVes, VES_DECIMALS));
  const amountToPayOriginal = Math.max(0, round(pendingOriginal - discountOriginal, ORIGINAL_DECIMALS));

  return {
    discountOriginal,
    discountVes,
    amountToPayOriginal,
    amountToPayVes,
    clamped: requested > pendingOriginal + 1e-9,
  };
}

/** ¿Efectivo + descuento cubren el pendiente? Decide `is_partial` y el estado del saldo. */
export function settlesInstallment(
  cashVes: number,
  discountVes: number,
  pendingVes: number,
  epsilon: number = SETTLEMENT_EPSILON_VES,
): boolean {
  return (Number(cashVes) || 0) + (Number(discountVes) || 0) >= (Number(pendingVes) || 0) - epsilon;
}

/** Valida una línea con descuento. Devuelve el mensaje en español o null si es válida. */
export function validateAdHocDiscount(
  draft: AdHocDiscountDraft | null | undefined,
  pendingOriginal: number,
  conceptName: string,
): string | null {
  if (!draft || draft.type === "none") return null;
  const value = Number(draft.value);
  if (!draft.value.trim() || Number.isNaN(value)) return `Indique el valor del descuento en "${conceptName}"`;
  if (value <= 0) return `El descuento de "${conceptName}" debe ser mayor a 0`;
  if (draft.type === "percentage" && value > 100) return `El descuento de "${conceptName}" no puede superar el 100%`;
  if (draft.type === "fixed" && value > (Number(pendingOriginal) || 0) + 1e-6) {
    return `El descuento de "${conceptName}" supera el pendiente de la cuota`;
  }
  if (!draft.reason.trim()) return `Indique el motivo del descuento en "${conceptName}"`;
  return null;
}

export function sumDiscountVes(rows: { discountVes: number }[]): number {
  return rows.reduce((sum, r) => sum + (Number(r.discountVes) || 0), 0);
}

/** Cobertura en VES de una línea de pago: efectivo + descuento. Usada al revertir pagos. */
export function itemCoverageVes(item: { amount_ves?: number | null; discount_amount_ves?: number | null }): number {
  return (Number(item.amount_ves) || 0) + (Number(item.discount_amount_ves) || 0);
}

/**
 * Cobertura en la moneda del concepto. `snapshotRate` es la tasa con la que se convierten los
 * pagos antiguos que no guardaron el monto original (compatibilidad hacia atrás).
 */
export function itemCoverageOriginal(
  item: {
    amount_ves?: number | null;
    original_amount?: number | null;
    discount_amount_ves?: number | null;
    discount_original_amount?: number | null;
  },
  snapshotRate: number,
): number {
  const rate = Number(snapshotRate) || 1;
  const cash = item.original_amount != null ? Number(item.original_amount) : (Number(item.amount_ves) || 0) / rate;
  const discount = item.discount_original_amount != null
    ? Number(item.discount_original_amount)
    : (Number(item.discount_amount_ves) || 0) / rate;
  return cash + discount;
}
