import { describe, expect, it } from "vitest";
import { calculateIslrWithholding, resolveIslrMinimum, resolveIslrSubtrahend, type IslrRate } from "./calculateIslrWithholding";

const contractorLegal: IslrRate = {
  base_pct: 100,
  rate_pct: 2,
  subtrahend_mode: "none",
  subtrahend_amount: 0,
  minimum_mode: "none",
  minimum_amount: 0,
};

const feesNatural: IslrRate = { ...contractorLegal, rate_pct: 3, subtrahend_mode: "auto", minimum_mode: "auto" };

describe("calculateIslrWithholding", () => {
  it("applies the plain percentage when there's no minimum or subtrahend", () => {
    const result = calculateIslrWithholding({ amountVes: 1000, rate: contractorLegal, taxUnitValue: 43 });
    expect(result.withheldVes).toBe(20);
  });

  it("derives minimum and subtrahend from the tax unit (UT 43 → 3.583,34 and 107,50)", () => {
    expect(resolveIslrMinimum(feesNatural, 43)).toBe(3583.34);
    expect(resolveIslrSubtrahend(feesNatural, 43, 3)).toBe(107.5);
  });

  it("doesn't withhold at or below the minimum", () => {
    const result = calculateIslrWithholding({ amountVes: 3583.34, rate: feesNatural, taxUnitValue: 43 });
    expect(result.withheldVes).toBe(0);
    expect(result.noWithholdingReason).toMatch(/mínimo/);
  });

  it("subtracts the subtrahend above the minimum", () => {
    const result = calculateIslrWithholding({ amountVes: 10000, rate: feesNatural, taxUnitValue: 43 });
    expect(result.withheldVes).toBe(192.5);
  });

  it("applies the percentage of the base", () => {
    const result = calculateIslrWithholding({
      amountVes: 1000,
      rate: { ...contractorLegal, base_pct: 90, rate_pct: 34 },
      taxUnitValue: 43,
    });
    expect(result.withheldVes).toBe(306);
  });

  it("uses manual minimum and subtrahend as typed", () => {
    const rate: IslrRate = {
      ...contractorLegal,
      subtrahend_mode: "manual",
      subtrahend_amount: 10,
      minimum_mode: "manual",
      minimum_amount: 500,
    };
    expect(calculateIslrWithholding({ amountVes: 500, rate, taxUnitValue: 43 }).withheldVes).toBe(0);
    expect(calculateIslrWithholding({ amountVes: 1000, rate, taxUnitValue: 43 }).withheldVes).toBe(10);
  });

  it("recomputes an automatic subtrahend with a one-off percentage", () => {
    const result = calculateIslrWithholding({ amountVes: 10000, rate: feesNatural, taxUnitValue: 43, overridePct: 5 });
    expect(result.appliedPct).toBe(5);
    expect(result.subtrahendVes).toBe(179.17);
    expect(result.withheldVes).toBe(320.83);
  });

  it("never goes negative and handles empty amounts", () => {
    const rate: IslrRate = { ...contractorLegal, subtrahend_mode: "manual", subtrahend_amount: 1000 };
    expect(calculateIslrWithholding({ amountVes: 100, rate, taxUnitValue: 43 }).withheldVes).toBe(0);
    expect(calculateIslrWithholding({ amountVes: 0, rate: contractorLegal, taxUnitValue: 43 }).noWithholdingReason).toMatch(/sin monto/i);
  });
});
