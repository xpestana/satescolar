import { describe, expect, it } from "vitest";
import {
  addMonths,
  formatMonthLabel,
  formatMonthList,
  formatUsd,
  joinSpanish,
  localDateParts,
  monthRange,
  normalizeMonthKey,
  pendingMonths,
} from "./billingMonths";

describe("normalizeMonthKey", () => {
  it("accepts months, dates and ISO strings", () => {
    expect(normalizeMonthKey("2026-03")).toBe("2026-03-01");
    expect(normalizeMonthKey("2026-03-17")).toBe("2026-03-01");
    expect(normalizeMonthKey("2026-03-01T00:00:00Z")).toBe("2026-03-01");
  });

  it("rejects empty or invalid values", () => {
    expect(normalizeMonthKey(null)).toBeNull();
    expect(normalizeMonthKey("")).toBeNull();
    expect(normalizeMonthKey("2026-13")).toBeNull();
    expect(normalizeMonthKey("marzo")).toBeNull();
  });
});

describe("addMonths / monthRange", () => {
  it("crosses year boundaries both ways", () => {
    expect(addMonths("2025-12-01", 1)).toBe("2026-01-01");
    expect(addMonths("2026-01-01", -1)).toBe("2025-12-01");
    expect(addMonths("2026-05-01", 12)).toBe("2027-05-01");
  });

  it("includes both ends and is empty when end is before start", () => {
    expect(monthRange("2025-11-01", "2026-02-01")).toEqual(["2025-11-01", "2025-12-01", "2026-01-01", "2026-02-01"]);
    expect(monthRange("2026-02-01", "2026-02-01")).toEqual(["2026-02-01"]);
    expect(monthRange("2026-03-01", "2026-02-01")).toEqual([]);
  });
});

describe("pendingMonths", () => {
  it("lists unpaid months up to the current one", () => {
    expect(
      pendingMonths({ startMonth: "2026-08-01", currentMonth: "2026-11-01", settledMonths: ["2026-08-01", "2026-10-01"] }),
    ).toEqual(["2026-09-01", "2026-11-01"]);
  });

  it("is empty without a start month, when everything is settled or when billing starts later", () => {
    expect(pendingMonths({ startMonth: null, currentMonth: "2026-11-01", settledMonths: [] })).toEqual([]);
    expect(pendingMonths({ startMonth: "2026-11-01", currentMonth: "2026-11-01", settledMonths: ["2026-11-01"] })).toEqual([]);
    expect(pendingMonths({ startMonth: "2027-01-01", currentMonth: "2026-11-01", settledMonths: [] })).toEqual([]);
  });

  it("ignores paid months outside the range", () => {
    expect(pendingMonths({ startMonth: "2026-11-01", currentMonth: "2026-11-01", settledMonths: ["2026-12-01"] })).toEqual([
      "2026-11-01",
    ]);
  });
});

describe("formatting", () => {
  it("formats months in Spanish", () => {
    expect(formatMonthLabel("2026-01-01")).toBe("enero 2026");
    expect(formatMonthList(["2026-11-01", "2026-10-01"])).toBe("octubre y noviembre de 2026");
    expect(formatMonthList(["2026-01-01", "2025-12-01", "2025-11-01"])).toBe("noviembre y diciembre de 2025 y enero de 2026");
    expect(formatMonthList([])).toBe("");
  });

  it("joins lists the Spanish way", () => {
    expect(joinSpanish(["a"])).toBe("a");
    expect(joinSpanish(["a", "b", "c"])).toBe("a, b y c");
  });

  it("formats USD with Venezuelan separators", () => {
    expect(formatUsd(120)).toBe("120,00 USD");
    expect(formatUsd(1234.5)).toBe("1.234,50 USD");
    expect(formatUsd(0)).toBe("0,00 USD");
  });
});

describe("localDateParts", () => {
  it("uses the Venezuelan calendar day", () => {
    // 2026-12-01 02:00 UTC is still November 30 in Caracas (UTC-4).
    expect(localDateParts(new Date("2026-12-01T02:00:00Z"))).toEqual({ date: "2026-11-30", day: 30, month: "2026-11-01" });
    expect(localDateParts(new Date("2026-11-15T13:00:00Z"))).toEqual({ date: "2026-11-15", day: 15, month: "2026-11-01" });
  });
});
