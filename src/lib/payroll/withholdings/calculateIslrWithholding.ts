import { round2 } from "../calculateNet";
import type { AmountMode } from "./types";

/** Factor of Decreto 1.808 (art. 9, parágrafo segundo) to derive the minimum from the tax unit. */
export const ISLR_UT_FACTOR = 83.3334;

export interface IslrRate {
  base_pct: number;
  rate_pct: number;
  subtrahend_mode: AmountMode;
  subtrahend_amount: number;
  minimum_mode: AmountMode;
  minimum_amount: number;
}

export interface IslrWithholdingInput {
  /** Amount paid in VES, without VAT. */
  amountVes: number;
  rate: IslrRate;
  taxUnitValue: number;
  /** One-off percentage for this payment; its reason is recorded by the caller. */
  overridePct?: number | null;
}

export interface IslrWithholdingResult {
  baseVes: number;
  basePct: number;
  appliedPct: number;
  minimumVes: number;
  subtrahendVes: number;
  withheldVes: number;
  noWithholdingReason: string | null;
}

const safe = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0);

/** The withholding threshold: derived from the tax unit, typed by hand, or none. */
export function resolveIslrMinimum(rate: IslrRate, taxUnitValue: number): number {
  if (rate.minimum_mode === "manual") return round2(safe(rate.minimum_amount));
  if (rate.minimum_mode === "auto") return round2(safe(taxUnitValue) * ISLR_UT_FACTOR);
  return 0;
}

/** The subtrahend: derived from the tax unit and the percentage, typed by hand, or none. */
export function resolveIslrSubtrahend(rate: IslrRate, taxUnitValue: number, appliedPct: number): number {
  if (rate.subtrahend_mode === "manual") return round2(safe(rate.subtrahend_amount));
  if (rate.subtrahend_mode === "auto") {
    return round2((safe(taxUnitValue) * ISLR_UT_FACTOR * safe(appliedPct)) / 100);
  }
  return 0;
}

/** ISLR withholding of one payment: `base × % base × % − subtrahend`, only above the minimum. */
export function calculateIslrWithholding(input: IslrWithholdingInput): IslrWithholdingResult {
  const amount = safe(input.amountVes);
  const hasOverride = input.overridePct !== null && input.overridePct !== undefined;
  const appliedPct = hasOverride ? safe(input.overridePct as number) : safe(input.rate.rate_pct);
  const basePct = safe(input.rate.base_pct);
  const minimumVes = resolveIslrMinimum(input.rate, input.taxUnitValue);
  const subtrahendVes = resolveIslrSubtrahend(input.rate, input.taxUnitValue, appliedPct);

  const result = { baseVes: round2(amount), basePct, appliedPct, minimumVes, subtrahendVes };

  if (amount <= 0) {
    return { ...result, withheldVes: 0, noWithholdingReason: "Pago sin monto gravable" };
  }
  if (minimumVes > 0 && amount <= minimumVes) {
    return { ...result, withheldVes: 0, noWithholdingReason: "Pago dentro del monto mínimo" };
  }

  const withheld = (amount * basePct * appliedPct) / 10000 - subtrahendVes;
  return { ...result, withheldVes: round2(Math.max(0, withheld)), noWithholdingReason: null };
}
