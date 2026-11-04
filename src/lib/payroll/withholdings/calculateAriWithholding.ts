import { round2 } from "../calculateNet";

export interface AriWithholdingInput {
  /** Taxable earnings of the payment, in VES. */
  taxableEarningsVes: number;
  /** The worker's AR-I percentage. */
  ariPct: number;
}

export interface AriWithholdingResult {
  baseVes: number;
  appliedPct: number;
  withheldVes: number;
  noWithholdingReason: string | null;
}

const safe = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0);

/** ISLR withholding on salaries: the worker's AR-I percentage over the taxable earnings. */
export function calculateAriWithholding(input: AriWithholdingInput): AriWithholdingResult {
  const baseVes = round2(safe(input.taxableEarningsVes));
  const appliedPct = safe(input.ariPct);
  if (baseVes <= 0) return { baseVes, appliedPct, withheldVes: 0, noWithholdingReason: "Pago sin asignaciones gravables" };
  if (appliedPct <= 0) return { baseVes, appliedPct, withheldVes: 0, noWithholdingReason: "AR-I en 0 %" };
  return { baseVes, appliedPct, withheldVes: round2((baseVes * appliedPct) / 100), noWithholdingReason: null };
}
