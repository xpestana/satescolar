/**
 * Months of the SAT Escolar subscription (pure, no Deno/React imports).
 * A month is a `MonthKey`: "YYYY-MM-01", the same value stored in `period_month`/`billing_start_month`.
 * Used by the `client-billing` Edge Function and by the admin screens (/admin/clientes).
 */

export type MonthKey = string;

/** Upper bound for month ranges, so a wrong start date cannot build an endless list. */
const MAX_MONTHS = 240;

const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export const BILLING_TIME_ZONE = "America/Caracas";

/** Accepts "YYYY-MM", "YYYY-MM-DD" or a longer ISO string; returns "YYYY-MM-01" or null. */
export function normalizeMonthKey(value: string | null | undefined): MonthKey | null {
  const match = /^(\d{4})-(\d{2})/.exec(String(value ?? "").trim());
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return `${match[1]}-${match[2]}-01`;
}

function parts(key: MonthKey): { year: number; month: number } {
  return { year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)) };
}

function fromParts(year: number, month: number): MonthKey {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;
}

export function addMonths(key: MonthKey, count: number): MonthKey {
  const { year, month } = parts(key);
  const index = year * 12 + (month - 1) + count;
  return fromParts(Math.floor(index / 12), (index % 12) + 1);
}

/** Calendar date ("YYYY-MM-DD") and day of month of `now` in the billing time zone. */
export function localDateParts(now: Date, timeZone = BILLING_TIME_ZONE): { date: string; day: number; month: MonthKey } {
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return { date: formatted, day: Number(formatted.slice(8, 10)), month: `${formatted.slice(0, 7)}-01` };
}

/** Every month from `start` to `end`, both included. Empty when end < start. */
export function monthRange(start: MonthKey, end: MonthKey): MonthKey[] {
  const months: MonthKey[] = [];
  let current = start;
  while (current <= end && months.length < MAX_MONTHS) {
    months.push(current);
    current = addMonths(current, 1);
  }
  return months;
}

/**
 * Months from the first billable month up to (and including) the current month that are neither
 * paid nor waived. No start month → nothing is billed yet.
 */
export function pendingMonths(input: {
  startMonth: string | null | undefined;
  currentMonth: MonthKey;
  settledMonths: Iterable<string>;
}): MonthKey[] {
  const start = normalizeMonthKey(input.startMonth);
  if (!start) return [];
  const settled = new Set<string>();
  for (const value of input.settledMonths) {
    const key = normalizeMonthKey(value);
    if (key) settled.add(key);
  }
  return monthRange(start, input.currentMonth).filter((month) => !settled.has(month));
}

/** "noviembre 2026" */
export function formatMonthLabel(key: MonthKey): string {
  const { year, month } = parts(key);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/** "noviembre" (no year) */
export function formatMonthName(key: MonthKey): string {
  return MONTH_NAMES[parts(key).month - 1];
}

/** "a", "a y b", "a, b y c" */
export function joinSpanish(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

/**
 * Human list of months grouped by year:
 * ["2026-10-01","2026-11-01"] → "octubre y noviembre de 2026";
 * ["2025-12-01","2026-01-01"] → "diciembre de 2025 y enero de 2026".
 */
export function formatMonthList(keys: MonthKey[]): string {
  const sorted = [...new Set(keys.map((k) => normalizeMonthKey(k)).filter((k): k is MonthKey => !!k))].sort();
  const byYear = new Map<number, string[]>();
  for (const key of sorted) {
    const { year } = parts(key);
    byYear.set(year, [...(byYear.get(year) ?? []), formatMonthName(key)]);
  }
  return joinSpanish([...byYear.entries()].map(([year, names]) => `${joinSpanish(names)} de ${year}`));
}

/** "1.234,50 USD" */
export function formatUsd(amount: number): string {
  const [integer, decimals] = Math.abs(amount).toFixed(2).split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${amount < 0 ? "-" : ""}${grouped},${decimals} USD`;
}
