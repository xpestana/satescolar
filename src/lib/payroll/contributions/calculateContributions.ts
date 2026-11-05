import { round2 } from "../calculateNet";
import {
  CONTRIBUTION_KINDS,
  contributionRule,
  type ContributionKind,
  type ContributionMethod,
  type ContributionParameters,
} from "./types";

/** First day of the month of a `YYYY-MM-DD` date. */
export function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

/** Mondays in the calendar month of a `YYYY-MM-DD` date. */
export function countMondays(date: string): number {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7)) - 1;
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  let mondays = 0;
  for (let day = 1; day <= days; day++) {
    if (new Date(Date.UTC(year, month, day)).getUTCDay() === 1) mondays++;
  }
  return mondays;
}

export interface ContributionInput {
  /** Earnings of the worker in the month that count for contributions, in VES. */
  monthBaseVes: number;
  /** Any date of the month (the period's end). */
  monthDate: string;
  parameters: ContributionParameters;
  /** What earlier payments of the month already discounted, per contribution. */
  previouslyDeductedVes?: Partial<Record<ContributionKind, number>>;
}

export interface ContributionResult {
  kind: ContributionKind;
  method: ContributionMethod;
  monthBaseVes: number;
  cappedBaseVes: number;
  capWages: number;
  minimumWageVes: number;
  ratePct: number;
  mondays: number | null;
  /** What the whole month owes. */
  monthTotalVes: number;
  previouslyDeductedVes: number;
  /** What this payment discounts: the month total minus what was already discounted. */
  amountVes: number;
}

const positive = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0);

/**
 * Employee contributions of the month. Each payment discounts what the month owes minus what
 * earlier payments of the same month already discounted, so caps apply to the whole month.
 */
export function calculateContributions(input: ContributionInput): ContributionResult[] {
  const monthBaseVes = round2(positive(input.monthBaseVes));
  const minimumWageVes = positive(input.parameters.minimum_wage_ves);
  const mondays = countMondays(input.monthDate);

  return CONTRIBUTION_KINDS.flatMap((kind): ContributionResult[] => {
    const rule = contributionRule(input.parameters, kind);
    const ratePct = positive(rule.pct);
    if (ratePct <= 0) return [];

    const cap = rule.capWages > 0 ? rule.capWages * minimumWageVes : Infinity;
    const cappedBaseVes = round2(Math.min(monthBaseVes, cap));
    const monthTotalVes =
      rule.method === "mondays"
        ? round2(((cappedBaseVes * 12) / 52) * (ratePct / 100) * mondays)
        : round2(cappedBaseVes * (ratePct / 100));
    const previouslyDeductedVes = round2(positive(input.previouslyDeductedVes?.[kind] ?? 0));

    return [
      {
        kind,
        method: rule.method,
        monthBaseVes,
        cappedBaseVes,
        capWages: rule.capWages,
        minimumWageVes,
        ratePct,
        mondays: rule.method === "mondays" ? mondays : null,
        monthTotalVes,
        previouslyDeductedVes,
        amountVes: round2(Math.max(0, monthTotalVes - previouslyDeductedVes)),
      },
    ];
  });
}
