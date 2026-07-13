/**
 * Per-user, temporary exchange-rate overrides.
 *
 * When a school user tweaks a rate in the ExchangeRateWidget we DO NOT write to
 * the shared `exchange_rates` table (that would change the rate for every school,
 * and it is also overwritten by the BCV auto-refresh). Instead we store a private
 * override in localStorage that lives for {@link OVERRIDE_TTL_MS} (3 hours) and then
 * expires, so the view/calculations fall back to the current official (BCV/DB) rate.
 *
 * The override is scoped by `school_id` + `currency` and is only visible in the
 * browser where it was set — i.e. "solo para ese usuario".
 */

export const OVERRIDE_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours

export interface RateOverride {
  rate: number;
  /** Epoch ms when the override stops applying. */
  expiresAt: number;
}

/** Event dispatched (same tab) whenever an override is set or cleared. */
const OVERRIDE_EVENT = "exchange-rate-override-changed";

const keyFor = (schoolId: string, currency: string) =>
  `bcv-rate-override:${schoolId}:${currency.toUpperCase()}`;

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readOverride(schoolId: string, currency: string): RateOverride | null {
  if (!schoolId || !currency) return null;
  const key = keyFor(schoolId, currency);
  const raw = safeGetItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as RateOverride;
    if (
      !parsed ||
      typeof parsed.rate !== "number" ||
      !Number.isFinite(parsed.rate) ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }
    // Expired → clean it up so the official rate takes over.
    if (Date.now() >= parsed.expiresAt) {
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Full override entry (rate + expiry) if a non-expired one exists. */
export function getRateOverride(schoolId: string, currency: string): RateOverride | null {
  return readOverride(schoolId, currency);
}

/** Override rate value if active, otherwise `null`. */
export function getOverrideRate(schoolId: string, currency: string): number | null {
  const o = readOverride(schoolId, currency);
  return o ? o.rate : null;
}

/**
 * Resolve the rate a school user should see/use: the personal override when
 * active, otherwise the official DB/BCV rate passed in.
 */
export function applyRateOverride(schoolId: string, currency: string, dbRate: number): number {
  const o = readOverride(schoolId, currency);
  return o ? o.rate : dbRate;
}

/** Store a personal override that expires in 3 hours. */
export function setRateOverride(schoolId: string, currency: string, rate: number): RateOverride {
  const entry: RateOverride = { rate, expiresAt: Date.now() + OVERRIDE_TTL_MS };
  try {
    localStorage.setItem(keyFor(schoolId, currency), JSON.stringify(entry));
  } catch {
    /* ignore */
  }
  notifyChange();
  return entry;
}

/** Remove a personal override so the official rate applies again. */
export function clearRateOverride(schoolId: string, currency: string): void {
  try {
    localStorage.removeItem(keyFor(schoolId, currency));
  } catch {
    /* ignore */
  }
  notifyChange();
}

function notifyChange(): void {
  try {
    window.dispatchEvent(new Event(OVERRIDE_EVENT));
  } catch {
    /* ignore */
  }
}

/**
 * Subscribe to override changes (same tab via custom event, other tabs via the
 * native `storage` event). Returns an unsubscribe function.
 */
export function subscribeRateOverrides(callback: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key.startsWith("bcv-rate-override:")) callback();
  };
  window.addEventListener(OVERRIDE_EVENT, callback);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(OVERRIDE_EVENT, callback);
    window.removeEventListener("storage", onStorage);
  };
}
