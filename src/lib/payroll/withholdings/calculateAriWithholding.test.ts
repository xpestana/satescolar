import { describe, expect, it } from "vitest";
import { calculateAriWithholding } from "./calculateAriWithholding";

describe("calculateAriWithholding", () => {
  it("applies the worker's percentage to taxable earnings", () => {
    expect(calculateAriWithholding({ taxableEarningsVes: 10000, ariPct: 2.5 }).withheldVes).toBe(250);
  });

  it("rounds to two decimals", () => {
    expect(calculateAriWithholding({ taxableEarningsVes: 333.33, ariPct: 1.5 }).withheldVes).toBe(5);
  });

  it("explains why nothing was withheld", () => {
    expect(calculateAriWithholding({ taxableEarningsVes: 10000, ariPct: 0 }).noWithholdingReason).toMatch(/0 %/);
    expect(calculateAriWithholding({ taxableEarningsVes: 0, ariPct: 3 }).noWithholdingReason).toMatch(/gravables/);
  });

  it("treats invalid numbers as zero", () => {
    expect(calculateAriWithholding({ taxableEarningsVes: Number.NaN, ariPct: -2 }).withheldVes).toBe(0);
  });
});
