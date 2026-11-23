import { todayCaracasIso } from "@/lib/dateUtils";

/** Current month in Venezuela as "YYYY-MM-01" (the billing month key). */
export function currentMonthKey(): string {
  return `${todayCaracasIso().slice(0, 7)}-01`;
}
