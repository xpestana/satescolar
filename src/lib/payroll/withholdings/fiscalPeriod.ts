import type { TaxType } from "./types";

export interface FiscalPeriod {
  start: string;
  end: string;
}

const pad = (value: number) => String(value).padStart(2, "0");

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Fiscal period of a payment date: IVA by fortnight (1–15, 16–end) and ISLR by month.
 * Works on the `YYYY-MM-DD` parts so a Venezuelan date never shifts to the previous day.
 */
export function fiscalPeriodOf(taxType: TaxType, date: string): FiscalPeriod {
  const [year, month, day] = date.slice(0, 10).split("-").map(Number);
  const prefix = `${year}-${pad(month)}`;
  const last = `${prefix}-${pad(lastDayOfMonth(year, month))}`;
  if (taxType === "islr") return { start: `${prefix}-01`, end: last };
  return day <= 15 ? { start: `${prefix}-01`, end: `${prefix}-15` } : { start: `${prefix}-16`, end: last };
}

/** Fiscal periods from `from` to `to` (newest first), to fill a period selector. */
export function listFiscalPeriods(taxType: TaxType, from: string, to: string): FiscalPeriod[] {
  const periods: FiscalPeriod[] = [];
  let cursor = fiscalPeriodOf(taxType, to);
  const earliest = fiscalPeriodOf(taxType, from).start;
  while (cursor.start >= earliest) {
    periods.push(cursor);
    const [year, month, day] = cursor.start.split("-").map(Number);
    const previous = new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
    cursor = fiscalPeriodOf(taxType, previous);
  }
  return periods;
}
