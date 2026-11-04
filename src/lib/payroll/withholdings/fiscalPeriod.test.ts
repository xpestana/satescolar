import { describe, expect, it } from "vitest";
import { fiscalPeriodOf, listFiscalPeriods } from "./fiscalPeriod";

describe("fiscalPeriodOf", () => {
  it("splits IVA at the 15th and the 16th", () => {
    expect(fiscalPeriodOf("vat", "2026-11-15")).toEqual({ start: "2026-11-01", end: "2026-11-15" });
    expect(fiscalPeriodOf("vat", "2026-11-16")).toEqual({ start: "2026-11-16", end: "2026-11-30" });
  });

  it("uses the real end of the month, including leap years", () => {
    expect(fiscalPeriodOf("vat", "2026-02-20").end).toBe("2026-02-28");
    expect(fiscalPeriodOf("vat", "2028-02-20").end).toBe("2028-02-29");
    expect(fiscalPeriodOf("vat", "2026-12-31").end).toBe("2026-12-31");
  });

  it("keeps ISLR on the whole month", () => {
    expect(fiscalPeriodOf("islr", "2026-11-04")).toEqual({ start: "2026-11-01", end: "2026-11-30" });
  });
});

describe("listFiscalPeriods", () => {
  it("lists fortnights newest first across a month change", () => {
    expect(listFiscalPeriods("vat", "2026-10-20", "2026-11-04").map((p) => p.start)).toEqual([
      "2026-11-01",
      "2026-10-16",
    ]);
  });

  it("lists months across a year change", () => {
    expect(listFiscalPeriods("islr", "2025-12-10", "2026-02-01").map((p) => p.start)).toEqual([
      "2026-02-01",
      "2026-01-01",
      "2025-12-01",
    ]);
  });
});
