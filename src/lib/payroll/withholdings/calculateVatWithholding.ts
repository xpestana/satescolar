import { round2 } from "../calculateNet";
import type { VatWithholdingMode } from "./types";

export interface VatWithholdingInput {
  /** Taxable base in VES, as printed on the invoice. */
  taxableBaseVes: number;
  /** VAT in VES, as printed on the invoice. */
  vatAmountVes: number;
  /** Invoice total in VES. */
  totalVes: number;
  /** VAT rate, used to split the tax when the invoice doesn't itemize it. */
  vatRatePct: number;
  mode: VatWithholdingMode;
  exclusionReason?: string | null;
  isPettyCash?: boolean;
  isVatNotItemized?: boolean;
  isNonCompliant?: boolean;
  standardPct: number;
  fullPct: number;
  taxUnitValue: number;
  pettyCashUtLimit: number;
  /** One-off percentage for this payment; its reason is recorded by the caller. */
  overridePct?: number | null;
}

export interface VatWithholdingResult {
  baseVes: number;
  taxAmountVes: number;
  appliedPct: number;
  withheldVes: number;
  noWithholdingReason: string | null;
}

const safe = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0);

/** IVA withholding of one invoice, per Providencia SNAT/2025/000054 (arts. 3, 4 and 5). */
export function calculateVatWithholding(input: VatWithholdingInput): VatWithholdingResult {
  const total = safe(input.totalVes);
  const rate = safe(input.vatRatePct);

  let base = safe(input.taxableBaseVes);
  let tax = safe(input.vatAmountVes);
  if (input.isVatNotItemized) {
    base = round2(total / (1 + rate / 100));
    tax = round2(total - base);
  }

  const none = (reason: string): VatWithholdingResult => ({
    baseVes: round2(base),
    taxAmountVes: round2(tax),
    appliedPct: 0,
    withheldVes: 0,
    noWithholdingReason: reason,
  });

  if (input.mode === "excluded") {
    return none(input.exclusionReason?.trim() || "Proveedor excluido de retención");
  }

  const pettyCashLimit = safe(input.pettyCashUtLimit) * safe(input.taxUnitValue);
  if (input.isPettyCash && total <= pettyCashLimit) {
    return none("Compra por caja chica dentro del límite");
  }

  if (tax <= 0) return none("Operación sin IVA causado");

  const hasOverride = input.overridePct !== null && input.overridePct !== undefined;
  const mustWithholdFull = input.mode === "full" || input.isVatNotItemized || input.isNonCompliant;
  const appliedPct = hasOverride
    ? safe(input.overridePct as number)
    : mustWithholdFull
      ? safe(input.fullPct)
      : safe(input.standardPct);

  return {
    baseVes: round2(base),
    taxAmountVes: round2(tax),
    appliedPct,
    withheldVes: round2((tax * appliedPct) / 100),
    noWithholdingReason: null,
  };
}
