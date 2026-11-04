import { describe, expect, it } from "vitest";
import { resolveRateVersion } from "./resolveRateVersion";

const versions = [
  { id: "b", valid_from: "2026-06-01" },
  { id: "a", valid_from: "2026-01-01" },
  { id: "c", valid_from: "2027-01-01" },
];

describe("resolveRateVersion", () => {
  it("picks the latest version in force on the date", () => {
    expect(resolveRateVersion(versions, "2026-11-04")?.id).toBe("b");
  });

  it("applies a version from its first day", () => {
    expect(resolveRateVersion(versions, "2026-06-01")?.id).toBe("b");
    expect(resolveRateVersion(versions, "2026-05-31")?.id).toBe("a");
  });

  it("ignores future-dated versions until they start", () => {
    expect(resolveRateVersion(versions, "2026-12-31")?.id).toBe("b");
    expect(resolveRateVersion(versions, "2027-01-01")?.id).toBe("c");
  });

  it("returns null when nothing is in force yet or the list is empty", () => {
    expect(resolveRateVersion(versions, "2025-12-31")).toBeNull();
    expect(resolveRateVersion([], "2026-11-04")).toBeNull();
  });
});
