import { describe, it, expect } from "vitest";
import { daysUntilExpiry, getModuleStatus, isModuleActive } from "./moduleStatus";

const NOW = new Date("2026-10-05T12:00:00Z");
const inDays = (d: number) => new Date(NOW.getTime() + d * 24 * 60 * 60 * 1000).toISOString();

describe("isModuleActive", () => {
  it("is inactive when there is no row", () => {
    expect(isModuleActive(null, NOW)).toBe(false);
    expect(isModuleActive(undefined, NOW)).toBe(false);
  });

  it("is inactive when disabled, even with a future expiry", () => {
    expect(isModuleActive({ enabled: false, expires_at: null }, NOW)).toBe(false);
    expect(isModuleActive({ enabled: false, expires_at: inDays(30) }, NOW)).toBe(false);
  });

  it("is active when enabled without expiry", () => {
    expect(isModuleActive({ enabled: true, expires_at: null }, NOW)).toBe(true);
  });

  it("is active until the exact expiry instant", () => {
    expect(isModuleActive({ enabled: true, expires_at: inDays(0.01) }, NOW)).toBe(true);
    expect(isModuleActive({ enabled: true, expires_at: NOW.toISOString() }, NOW)).toBe(false);
    expect(isModuleActive({ enabled: true, expires_at: inDays(-1) }, NOW)).toBe(false);
  });
});

describe("daysUntilExpiry", () => {
  it("returns null without an expiry date", () => {
    expect(daysUntilExpiry({ enabled: true, expires_at: null }, NOW)).toBeNull();
    expect(daysUntilExpiry(null, NOW)).toBeNull();
  });

  it("rounds partial days up", () => {
    expect(daysUntilExpiry({ enabled: true, expires_at: inDays(2.2) }, NOW)).toBe(3);
    expect(daysUntilExpiry({ enabled: true, expires_at: inDays(0.5) }, NOW)).toBe(1);
  });

  it("is zero or negative once expired", () => {
    expect(daysUntilExpiry({ enabled: true, expires_at: inDays(-3) }, NOW)).toBe(-3);
  });
});

describe("getModuleStatus", () => {
  it("classifies every state", () => {
    expect(getModuleStatus(null, NOW)).toBe("disabled");
    expect(getModuleStatus({ enabled: false, expires_at: null }, NOW)).toBe("disabled");
    expect(getModuleStatus({ enabled: true, expires_at: inDays(-1) }, NOW)).toBe("expired");
    expect(getModuleStatus({ enabled: true, expires_at: inDays(5) }, NOW)).toBe("expiring");
    expect(getModuleStatus({ enabled: true, expires_at: inDays(7) }, NOW)).toBe("expiring");
    expect(getModuleStatus({ enabled: true, expires_at: inDays(8) }, NOW)).toBe("active");
    expect(getModuleStatus({ enabled: true, expires_at: null }, NOW)).toBe("active");
  });

  it("honours a custom expiring window", () => {
    expect(getModuleStatus({ enabled: true, expires_at: inDays(20) }, NOW, 30)).toBe("expiring");
  });
});
