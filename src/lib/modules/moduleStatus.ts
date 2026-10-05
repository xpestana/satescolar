/** Row of `school_modules` needed to decide whether a module is usable. */
export interface SchoolModuleState {
  enabled: boolean;
  expires_at: string | null;
}

export type ModuleStatus = "active" | "expiring" | "expired" | "disabled";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days to show the "expiring soon" status before a module's expiry date. */
export const EXPIRING_WINDOW_DAYS = 7;

/** A module is active when enabled and its expiry (if any) is still in the future. */
export function isModuleActive(state: SchoolModuleState | null | undefined, now: Date = new Date()): boolean {
  if (!state?.enabled) return false;
  if (!state.expires_at) return true;
  return new Date(state.expires_at).getTime() > now.getTime();
}

/** Whole days left until expiry (rounded up), or null when there is no expiry date. */
export function daysUntilExpiry(state: SchoolModuleState | null | undefined, now: Date = new Date()): number | null {
  if (!state?.expires_at) return null;
  return Math.ceil((new Date(state.expires_at).getTime() - now.getTime()) / DAY_MS);
}

export function getModuleStatus(
  state: SchoolModuleState | null | undefined,
  now: Date = new Date(),
  expiringWindowDays: number = EXPIRING_WINDOW_DAYS,
): ModuleStatus {
  if (!state?.enabled) return "disabled";
  if (!isModuleActive(state, now)) return "expired";
  const days = daysUntilExpiry(state, now);
  if (days !== null && days <= expiringWindowDays) return "expiring";
  return "active";
}
