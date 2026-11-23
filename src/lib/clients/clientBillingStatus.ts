/**
 * Billing status of SAT Escolar's client schools, for the admin screens (pure).
 * Month math lives in the shared module so the screens and the reminder emails always agree.
 */
import {
  addMonths,
  monthRange,
  normalizeMonthKey,
  pendingMonths,
  type MonthKey,
} from "../../../supabase/functions/_shared/billing/billingMonths.ts";

export type ClientAccountType = "demo" | "client" | "inactive";

export const ACCOUNT_TYPE_LABELS: Record<ClientAccountType, string> = {
  demo: "Demo",
  client: "Cliente real",
  inactive: "Inactivo",
};

export function isClientAccountType(value: string): value is ClientAccountType {
  return value === "demo" || value === "client" || value === "inactive";
}

export type BillingStatus = "up_to_date" | "pending" | "not_configured" | "demo" | "inactive";

export const BILLING_STATUS_LABELS: Record<BillingStatus, string> = {
  up_to_date: "Al día",
  pending: "Con deuda",
  not_configured: "Sin configurar",
  demo: "Demo",
  inactive: "Inactivo",
};

export interface ClientBillingInput {
  accountType: string;
  startMonth: string | null;
  monthlyFeeUsd: number | null;
  settledMonths: string[];
  currentMonth: MonthKey;
}

export interface ClientBillingSnapshot {
  status: BillingStatus;
  pendingMonths: MonthKey[];
  /** null when the fee is not set. */
  amountDueUsd: number | null;
}

export function summarizeClientBilling(input: ClientBillingInput): ClientBillingSnapshot {
  const pending = pendingMonths({
    startMonth: input.startMonth,
    currentMonth: input.currentMonth,
    settledMonths: input.settledMonths,
  });
  const fee = input.monthlyFeeUsd != null ? Number(input.monthlyFeeUsd) : null;
  const amountDueUsd = fee != null ? Math.round(fee * pending.length * 100) / 100 : null;

  let status: BillingStatus;
  if (input.accountType === "demo") status = "demo";
  else if (input.accountType === "inactive") status = "inactive";
  else if (!normalizeMonthKey(input.startMonth) || fee == null) status = "not_configured";
  else status = pending.length > 0 ? "pending" : "up_to_date";

  return { status, pendingMonths: pending, amountDueUsd };
}

export interface ClientsOverviewItem {
  accountType: string;
  monthlyFeeUsd: number | null;
  snapshot: ClientBillingSnapshot;
  demoEndsOn: string | null;
}

export interface ClientsOverview {
  clients: number;
  demos: number;
  inactive: number;
  /** Monthly recurring revenue of real clients. */
  monthlyRevenueUsd: number;
  /** Debt of real clients (pending months × fee). */
  debtUsd: number;
  clientsWithDebt: number;
  /** Demos whose end date is within `soonDays` (or already passed). */
  demosEndingSoon: number;
}

export function summarizeClients(items: ClientsOverviewItem[], todayIso: string, soonDays = 7): ClientsOverview {
  const soonLimit = addDays(todayIso, soonDays);
  const overview: ClientsOverview = {
    clients: 0,
    demos: 0,
    inactive: 0,
    monthlyRevenueUsd: 0,
    debtUsd: 0,
    clientsWithDebt: 0,
    demosEndingSoon: 0,
  };
  for (const item of items) {
    if (item.accountType === "client") {
      overview.clients++;
      overview.monthlyRevenueUsd += Number(item.monthlyFeeUsd ?? 0);
      if (item.snapshot.status === "pending") {
        overview.clientsWithDebt++;
        overview.debtUsd += item.snapshot.amountDueUsd ?? 0;
      }
    } else if (item.accountType === "demo") {
      overview.demos++;
      if (item.demoEndsOn && item.demoEndsOn <= soonLimit) overview.demosEndingSoon++;
    } else {
      overview.inactive++;
    }
  }
  overview.monthlyRevenueUsd = Math.round(overview.monthlyRevenueUsd * 100) / 100;
  overview.debtUsd = Math.round(overview.debtUsd * 100) / 100;
  return overview;
}

/** "YYYY-MM-DD" + n days, as a calendar date (no time zone shifts). */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/**
 * Months shown in the payments grid: `monthsBefore` months before the first billable month (or the
 * last year when it is not set), so earlier payments can be recorded, up to `monthsAhead` months
 * after the current one, so prepayments (e.g. a whole year) fit. Never more than 3 years back.
 */
export function gridMonths(
  startMonth: string | null,
  currentMonth: MonthKey,
  monthsAhead = 11,
  monthsBefore = 5,
): MonthKey[] {
  const start = normalizeMonthKey(startMonth);
  const latestFirst = addMonths(currentMonth, -monthsBefore);
  let first = start ? addMonths(start, -monthsBefore) : addMonths(currentMonth, -11);
  if (first > latestFirst) first = latestFirst;
  const earliest = addMonths(currentMonth, -36);
  if (first < earliest) first = earliest;
  return monthRange(first, addMonths(currentMonth, monthsAhead));
}

export type MonthCellState = "paid" | "waived" | "pending" | "past" | "upcoming";

export function monthCellState(
  month: MonthKey,
  settled: Map<string, "paid" | "waived">,
  startMonth: string | null,
  currentMonth: MonthKey,
): MonthCellState {
  const status = settled.get(month);
  if (status) return status;
  const start = normalizeMonthKey(startMonth);
  if (start && month >= start && month <= currentMonth) return "pending";
  return month < currentMonth ? "past" : "upcoming";
}
