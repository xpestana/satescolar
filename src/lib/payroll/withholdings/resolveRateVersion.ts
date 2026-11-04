import type { VersionedRow } from "./types";

/**
 * The version in force on `date`: the latest `valid_from` that isn't after it.
 * Dates are compared as `YYYY-MM-DD` strings on purpose, to avoid time-zone shifts.
 */
export function resolveRateVersion<T extends VersionedRow>(versions: T[], date: string): T | null {
  let current: T | null = null;
  for (const version of versions ?? []) {
    if (version.valid_from > date) continue;
    if (!current || version.valid_from > current.valid_from) current = version;
  }
  return current;
}
