// Employee contributions discounted from salaries (IVSS, paro forzoso / RPE, FAOV).
// Framework-free so the calculators stay pure.

import type { VersionedRow } from "../withholdings/types";

export type ContributionKind = "ivss" | "rpe" | "faov";
/** mondays: weekly salary (month × 12 ÷ 52) × Mondays of the month. monthly: over the month. */
export type ContributionMethod = "mondays" | "monthly";

export const CONTRIBUTION_KINDS: ContributionKind[] = ["ivss", "rpe", "faov"];

export const CONTRIBUTION_LABELS: Record<ContributionKind, string> = {
  ivss: "IVSS",
  rpe: "Paro forzoso",
  faov: "FAOV",
};

export const CONTRIBUTION_METHOD_LABELS: Record<ContributionMethod, string> = {
  mondays: "Semanal × lunes del mes",
  monthly: "Sobre el mes",
};

export interface ContributionParameters extends VersionedRow {
  school_id: string;
  minimum_wage_ves: number;
  ivss_pct: number;
  ivss_cap_wages: number;
  ivss_method: ContributionMethod;
  rpe_pct: number;
  rpe_cap_wages: number;
  rpe_method: ContributionMethod;
  faov_pct: number;
  faov_cap_wages: number;
  faov_method: ContributionMethod;
  created_at?: string;
}

export interface ContributionSettings {
  school_id: string;
  enabled: boolean;
  rates_validated_at: string | null;
}

/** Starting values; the school's accountant must confirm them. */
export const DEFAULT_CONTRIBUTION_PARAMETERS = {
  valid_from: "2026-01-01",
  minimum_wage_ves: 130,
  ivss_pct: 4,
  ivss_cap_wages: 5,
  ivss_method: "mondays" as ContributionMethod,
  rpe_pct: 0.5,
  rpe_cap_wages: 10,
  rpe_method: "mondays" as ContributionMethod,
  faov_pct: 1,
  faov_cap_wages: 0,
  faov_method: "monthly" as ContributionMethod,
};

export function contributionRule(parameters: ContributionParameters, kind: ContributionKind) {
  return {
    pct: Number(parameters[`${kind}_pct`]) || 0,
    capWages: Number(parameters[`${kind}_cap_wages`]) || 0,
    method: parameters[`${kind}_method`],
  };
}
