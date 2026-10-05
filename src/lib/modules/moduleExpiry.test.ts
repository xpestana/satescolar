import { describe, it, expect } from "vitest";
import { expiryFromLastActiveDay, lastActiveDayFromExpiry } from "./moduleExpiry";

describe("expiryFromLastActiveDay", () => {
  it("expires at the end of the chosen day in Venezuela (next day 04:00 UTC)", () => {
    expect(expiryFromLastActiveDay(new Date(2026, 10, 15))).toBe("2026-11-16T04:00:00.000Z");
  });

  it("rolls over month and year ends", () => {
    expect(expiryFromLastActiveDay(new Date(2026, 9, 31))).toBe("2026-11-01T04:00:00.000Z");
    expect(expiryFromLastActiveDay(new Date(2026, 11, 31))).toBe("2027-01-01T04:00:00.000Z");
  });

  it("ignores the time of day of the picked date", () => {
    expect(expiryFromLastActiveDay(new Date(2026, 10, 15, 23, 59))).toBe("2026-11-16T04:00:00.000Z");
  });
});

describe("lastActiveDayFromExpiry", () => {
  it("is the inverse of expiryFromLastActiveDay", () => {
    for (const day of [new Date(2026, 10, 15), new Date(2026, 11, 31), new Date(2027, 1, 28)]) {
      const back = lastActiveDayFromExpiry(expiryFromLastActiveDay(day));
      expect([back.getFullYear(), back.getMonth(), back.getDate()]).toEqual([
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
      ]);
    }
  });

  it("maps any timestamp to the Venezuelan day it falls in", () => {
    // 2026-11-16 02:00 UTC is still 2026-11-15 22:00 in Venezuela.
    const d = lastActiveDayFromExpiry("2026-11-16T02:00:00Z");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 10, 15]);
  });
});
