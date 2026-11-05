// Earlier salary payments of the same worker in the month, reduced to what a discounting
// payment needs: their bases (in VES) and what they already discounted.

import { convertToVes, round2 } from "../calculateNet";
import type { ConceptKind, PayrollConcept, PayrollCurrency } from "../types";
import type { ContributionKind } from "./types";

/** A live salary payment of the month, as read from the database. */
export interface MonthPaymentRow {
  id: string;
  status: string;
  currency: PayrollCurrency;
  exchange_rate: number;
  period: { id: string; name: string; end_date: string; apply_deductions: boolean };
  items: {
    concept_id: string | null;
    concept_kind: ConceptKind;
    amount: number;
    amount_ves?: number | null;
    withholding_id: string | null;
    contribution_id: string | null;
  }[];
  contributions: { kind: ContributionKind; amount_ves: number }[];
}

export interface PriorPayment {
  id: string;
  label: string;
  /** Whether its period discounted; if not, its earnings go into this payment's AR-I. */
  applyDeductions: boolean;
  islrBaseVes: number;
  contributionBaseVes: number;
  deductedContributionsVes: Partial<Record<ContributionKind, number>>;
}

export interface MonthPayments {
  /** Same month, in periods ending earlier: summed into a discounting payment. */
  prior: PriorPayment[];
  /** Same month, in periods ending later and discounting: they were calculated without this one. */
  laterDiscounting: { id: string; label: string; status: string }[];
}

/** Concept flags; a line without a concept counts for both bases. */
export function lineFlags(conceptId: string | null, concepts: PayrollConcept[]) {
  const concept = conceptId ? concepts.find((c) => c.id === conceptId) : undefined;
  return {
    isTaxable: concept?.is_islr_taxable ?? true,
    isContributionBase: concept?.is_contribution_base ?? true,
  };
}

export function summarizePriorPayment(row: MonthPaymentRow, concepts: PayrollConcept[]): PriorPayment {
  let islr = 0;
  let contribution = 0;
  for (const item of row.items) {
    if (item.concept_kind !== "earning" || item.withholding_id || item.contribution_id) continue;
    const amountVes =
      item.amount_ves != null
        ? Number(item.amount_ves)
        : convertToVes(Math.max(0, item.amount || 0), row.currency, row.exchange_rate);
    const flags = lineFlags(item.concept_id, concepts);
    if (flags.isTaxable) islr += amountVes;
    if (flags.isContributionBase) contribution += amountVes;
  }
  const deducted: Partial<Record<ContributionKind, number>> = {};
  for (const c of row.contributions) deducted[c.kind] = round2((deducted[c.kind] ?? 0) + (c.amount_ves || 0));
  return {
    id: row.id,
    label: row.period.name,
    applyDeductions: row.period.apply_deductions,
    islrBaseVes: round2(islr),
    contributionBaseVes: round2(contribution),
    deductedContributionsVes: deducted,
  };
}

/**
 * Splits the worker's live payments of the month around the current period. Payments whose
 * period ends the same day are left out, as the database does.
 */
export function splitMonthPayments(
  rows: MonthPaymentRow[],
  periodEndDate: string,
  concepts: PayrollConcept[]
): MonthPayments {
  const month = periodEndDate.slice(0, 7);
  const sameMonth = rows.filter((r) => r.status !== "voided" && r.period.end_date.slice(0, 7) === month);
  return {
    prior: sameMonth
      .filter((r) => r.period.end_date < periodEndDate)
      .sort((a, b) => a.period.end_date.localeCompare(b.period.end_date))
      .map((r) => summarizePriorPayment(r, concepts)),
    laterDiscounting: sameMonth
      .filter((r) => r.period.end_date > periodEndDate && r.period.apply_deductions)
      .map((r) => ({ id: r.id, label: r.period.name, status: r.status })),
  };
}
