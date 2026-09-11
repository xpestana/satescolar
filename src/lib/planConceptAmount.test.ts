import { describe, expect, it } from "vitest";
import { calcFinalAmount } from "./planConceptAmount";

describe("calcFinalAmount", () => {
  it("returns the amount without discount", () => {
    expect(calcFinalAmount(75, "none", 0)).toBe(75);
  });

  it("applies a percentage discount", () => {
    expect(calcFinalAmount(80, "percentage", 25)).toBe(60);
  });

  it("applies a fixed discount", () => {
    expect(calcFinalAmount(75, "fixed", 15)).toBe(60);
  });

  it("never goes below zero", () => {
    expect(calcFinalAmount(10, "fixed", 50)).toBe(0);
    expect(calcFinalAmount(10, "percentage", 150)).toBe(0);
  });
});
