import { describe, it, expect } from "vitest";
import { isSellableModuleKey, MODULE_CATALOG, SELLABLE_MODULE_KEYS } from "./moduleCatalog";

describe("MODULE_CATALOG", () => {
  it("describes every sellable module with a name and benefits", () => {
    for (const key of SELLABLE_MODULE_KEYS) {
      const info = MODULE_CATALOG[key];
      expect(info.key).toBe(key);
      expect(info.name.length).toBeGreaterThan(0);
      expect(info.benefits.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("matches the CHECK constraint of school_modules", () => {
    expect([...SELLABLE_MODULE_KEYS].sort()).toEqual(
      ["attendance", "grades", "messaging", "ministry_forms", "payments", "virtual_classroom"],
    );
  });
});

describe("isSellableModuleKey", () => {
  it("accepts sellable keys only", () => {
    expect(isSellableModuleKey("payments")).toBe(true);
    expect(isSellableModuleKey("registration")).toBe(false);
    expect(isSellableModuleKey("PAYMENTS")).toBe(false);
    expect(isSellableModuleKey(null)).toBe(false);
  });
});
