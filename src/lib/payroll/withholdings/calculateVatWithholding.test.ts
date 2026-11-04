import { describe, expect, it } from "vitest";
import { calculateVatWithholding, type VatWithholdingInput } from "./calculateVatWithholding";

const base: VatWithholdingInput = {
  taxableBaseVes: 1000,
  vatAmountVes: 160,
  totalVes: 1160,
  vatRatePct: 16,
  mode: "standard",
  standardPct: 75,
  fullPct: 100,
  taxUnitValue: 43,
  pettyCashUtLimit: 20,
};

describe("calculateVatWithholding", () => {
  it("withholds 75 % of the VAT by default", () => {
    const result = calculateVatWithholding(base);
    expect(result.withheldVes).toBe(120);
    expect(result.appliedPct).toBe(75);
    expect(result.noWithholdingReason).toBeNull();
  });

  it("withholds 100 % for a supplier flagged as full", () => {
    expect(calculateVatWithholding({ ...base, mode: "full" }).withheldVes).toBe(160);
  });

  it("withholds 100 % on a non-compliant invoice", () => {
    expect(calculateVatWithholding({ ...base, isNonCompliant: true }).appliedPct).toBe(100);
  });

  it("splits the tax out of the total when VAT isn't itemized and withholds 100 %", () => {
    const result = calculateVatWithholding({
      ...base,
      taxableBaseVes: 0,
      vatAmountVes: 0,
      isVatNotItemized: true,
    });
    expect(result.baseVes).toBe(1000);
    expect(result.taxAmountVes).toBe(160);
    expect(result.withheldVes).toBe(160);
  });

  it("doesn't withhold from an excluded supplier and keeps the reason", () => {
    const result = calculateVatWithholding({ ...base, mode: "excluded", exclusionReason: "Contribuyente formal" });
    expect(result.withheldVes).toBe(0);
    expect(result.noWithholdingReason).toBe("Contribuyente formal");
  });

  it("doesn't withhold on exempt invoices", () => {
    const result = calculateVatWithholding({ ...base, taxableBaseVes: 0, vatAmountVes: 0, totalVes: 1000 });
    expect(result.withheldVes).toBe(0);
    expect(result.noWithholdingReason).toMatch(/sin IVA/i);
  });

  it("applies the petty-cash exclusion only up to the limit (20 UT = Bs 860)", () => {
    const atLimit = { ...base, taxableBaseVes: 741.38, vatAmountVes: 118.62, totalVes: 860, isPettyCash: true };
    expect(calculateVatWithholding(atLimit).withheldVes).toBe(0);
    expect(calculateVatWithholding({ ...atLimit, totalVes: 860.01 }).withheldVes).toBe(88.97);
  });

  it("uses a one-off percentage, even a 0 %", () => {
    expect(calculateVatWithholding({ ...base, overridePct: 50 }).withheldVes).toBe(80);
    expect(calculateVatWithholding({ ...base, overridePct: 0 }).withheldVes).toBe(0);
  });

  it("treats negative or invalid amounts as zero", () => {
    const result = calculateVatWithholding({ ...base, taxableBaseVes: -5, vatAmountVes: Number.NaN, totalVes: -1 });
    expect(result.withheldVes).toBe(0);
  });
});
