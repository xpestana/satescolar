/**
 * The admin picks the last day a module stays active ("activo hasta el 15/11").
 * It is stored in `school_modules.expires_at` as the end of that day in Venezuela
 * (UTC-4, no daylight saving), i.e. the next day at 00:00 VET = 04:00 UTC.
 */
const VET_OFFSET_HOURS = 4;
const HOUR_MS = 60 * 60 * 1000;

/** Calendar day (read from its local date parts) → `expires_at` ISO timestamp. */
export function expiryFromLastActiveDay(day: Date): string {
  return new Date(
    Date.UTC(day.getFullYear(), day.getMonth(), day.getDate() + 1, VET_OFFSET_HOURS),
  ).toISOString();
}

/** `expires_at` ISO timestamp → last active calendar day (local midnight Date). */
export function lastActiveDayFromExpiry(expiresAt: string): Date {
  const vetInstant = new Date(new Date(expiresAt).getTime() - VET_OFFSET_HOURS * HOUR_MS - 1);
  return new Date(vetInstant.getUTCFullYear(), vetInstant.getUTCMonth(), vetInstant.getUTCDate());
}
