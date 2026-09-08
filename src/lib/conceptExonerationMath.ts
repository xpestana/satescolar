/**
 * Aritmética de la exoneración de una cuota (sin acceso a datos, para poder probarla sola).
 *
 * Regla: lo que se perdona se lleva en la **moneda original** del concepto y se congela en VES
 * a la **tasa del día**, igual que un cobro. El pendiente vive en
 * `balance / exchange_rate_snapshot`, así que un saldo sembrado con una tasa vieja hay que
 * revaluarlo antes de mostrarlo o registrarlo.
 *
 * El acceso a datos (insertar la exoneración y cerrar el saldo) vive en `conceptExonerations.ts`.
 */

/** Fila de `student_concept_balances` con lo mínimo para exonerar y revertir. */
export interface ExonerableBalance {
  id: string;
  school_id: string;
  school_year_id: string;
  student_id: string;
  plan_concept_id: string;
  currency?: string | null;
  original_amount?: number | null;
  exchange_rate_snapshot?: number | null;
  total_amount?: number | null;
  paid_amount?: number | null;
  balance?: number | null;
}

const positive = (n: unknown) => (Number(n) > 0 ? Number(n) : 0);

const isVes = (balance: ExonerableBalance) => (balance.currency || "VES") === "VES";

/**
 * Pendiente de la cuota en su **moneda original** (para VES, los mismos bolívares).
 * Espeja `getRemainingOriginal()` de los modales de registro.
 */
export const exonerableRemainingOriginal = (balance: ExonerableBalance): number => {
  const pending = Math.max(0, Number(balance.balance) || 0);
  if (isVes(balance)) return pending;
  const snapshot = positive(balance.exchange_rate_snapshot);
  return snapshot > 0 ? pending / snapshot : pending;
};

/**
 * Pendiente de la cuota en VES: es exactamente lo que se perdona.
 * Con `currentRate` se revalúa a la tasa del día (lo que muestran y registran los modales de
 * pago); sin ella se usa la tasa congelada del ledger, que es lo que muestran las pantallas de
 * bolívares almacenados (estado de cuenta).
 */
export const exonerablePendingVes = (balance: ExonerableBalance, currentRate?: number | null): number => {
  if (isVes(balance)) return Math.max(0, Number(balance.balance) || 0);
  const rate = positive(currentRate) || positive(balance.exchange_rate_snapshot) || 1;
  return Math.max(0, exonerableRemainingOriginal(balance) * rate);
};

/** Total de la cuota en moneda original, con respaldo para filas viejas sin `original_amount`. */
export const exonerableTotalOriginal = (balance: ExonerableBalance): number => {
  const stored = positive(balance.original_amount);
  if (stored > 0) return stored;
  const total = Math.max(0, Number(balance.total_amount) || 0);
  if (isVes(balance)) return total;
  const snapshot = positive(balance.exchange_rate_snapshot);
  return snapshot > 0 ? total / snapshot : total;
};

/**
 * Cómo queda el ledger al exonerar: la cuota se salda y el total se revalúa a la tasa aplicada,
 * conservando el invariante `paid_amount + balance = total_amount`.
 */
export interface ExonerationSettlement {
  /** Tasa efectivamente aplicada (la del día si vino, si no la congelada). */
  rate: number;
  /** Pendiente perdonado en moneda original. */
  pendingOriginal: number;
  /** Pendiente perdonado en VES a `rate` — lo que se guarda en `amount_ves`. */
  pendingVes: number;
  /** Nuevo `total_amount` del balance (= nuevo `paid_amount`, con `balance` en 0). */
  newTotalVes: number;
}

export function computeExonerationSettlement(
  balance: ExonerableBalance,
  currentRate?: number | null,
): ExonerationSettlement {
  const snapshot = positive(balance.exchange_rate_snapshot) || 1;
  const rate = isVes(balance) ? 1 : (positive(currentRate) || snapshot);
  const pendingOriginal = exonerableRemainingOriginal(balance);
  const pendingVes = isVes(balance) ? pendingOriginal : pendingOriginal * rate;
  const newTotalVes = isVes(balance)
    ? Math.max(0, Number(balance.total_amount) || 0)
    : parseFloat((exonerableTotalOriginal(balance) * rate).toFixed(2));
  return { rate, pendingOriginal, pendingVes, newTotalVes };
}
