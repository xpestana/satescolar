import { describe, expect, it } from "vitest";
import { formatVoucherNumber, isValidVoucherNumber } from "./voucherNumber";

describe("voucherNumber", () => {
  it("builds the 14-character format", () => {
    const number = formatVoucherNumber("2026-11-04", 123);
    expect(number).toBe("20261100000123");
    expect(number).toHaveLength(14);
  });

  it("validates the format", () => {
    expect(isValidVoucherNumber("20261100000123")).toBe(true);
    expect(isValidVoucherNumber("20261300000123")).toBe(false);
    expect(isValidVoucherNumber("2026110000012")).toBe(false);
    expect(isValidVoucherNumber("ABCD1100000123")).toBe(false);
  });
});
