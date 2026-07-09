// Pure payroll math: derive gross/deductions/net from line items and convert to VES.
// The net is always computed here so the UI never asks the user to type it by hand.

import type { PayrollCurrency, PayrollLineItem } from "./types";

export interface PayrollTotals {
  gross: number;
  deductions: number;
  net: number;
}

/** Round to 2 decimals avoiding binary FP drift (e.g. 1.005 -> 1.01). */
export function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Negative or non-finite amounts are treated as 0 (money is never negative here). */
function safeAmount(amount: number): number {
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return amount;
}

/**
 * Sum earnings and deductions from the line items.
 * `net` = gross - deductions, clamped at 0 (deductions can't produce a negative payout).
 */
export function calculatePayrollTotals(items: PayrollLineItem[]): PayrollTotals {
  let gross = 0;
  let deductions = 0;
  for (const item of items ?? []) {
    const amount = safeAmount(item.amount);
    if (item.concept_kind === "deduction") deductions += amount;
    else gross += amount;
  }
  const net = Math.max(0, gross - deductions);
  return { gross: round2(gross), deductions: round2(deductions), net: round2(net) };
}

/** True when deductions exceed earnings — the UI should block saving in that case. */
export function deductionsExceedEarnings(items: PayrollLineItem[]): boolean {
  const { gross, deductions } = calculatePayrollTotals(items);
  return deductions > gross;
}

/**
 * Convert an amount in the payment currency to VES.
 * For VES the rate is ignored (1:1); for USD it multiplies by rate_to_ves.
 */
export function convertToVes(
  amount: number,
  currency: PayrollCurrency,
  rateToVes: number
): number {
  const safe = safeAmount(amount);
  if (currency === "VES") return round2(safe);
  const rate = Number.isFinite(rateToVes) && rateToVes > 0 ? rateToVes : 0;
  return round2(safe * rate);
}
