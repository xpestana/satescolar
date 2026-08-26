/**
 * Cobertura de un comprobante: si sus lineas saldan la cuota completa o son un abono parcial.
 *
 * Es distinto de `payments.status`, que describe el estado del *documento*
 * (`completed` / `voided`) y por eso marca igual un abono parcial que uno completo.
 * Esta cobertura se deriva de `payment_items.is_partial`.
 */
export type PaymentCoverage = {
  label: string;
  className: string;
};

export function getPaymentCoverage(payment: {
  payment_items?: { is_partial?: boolean | null }[] | null;
}): PaymentCoverage {
  const items = payment.payment_items || [];
  const partialCount = items.filter((it) => it.is_partial).length;

  if (partialCount === 0) {
    return {
      label: "Completo",
      className: "whitespace-nowrap border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    };
  }

  return {
    label: partialCount === items.length ? "Parcial" : "Parcial (mixto)",
    className: "whitespace-nowrap border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  };
}
