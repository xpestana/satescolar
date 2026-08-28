import { describe, it, expect } from "vitest";
import { gateMessage, isGradesGateReason, GradesGateReason } from "./gradesAccess";

describe("isGradesGateReason", () => {
  it("accepts every value the RPC can return", () => {
    const reasons: GradesGateReason[] = [
      "ok", "not_child", "blocked_by_school", "delinquent", "hidden_by_school",
    ];
    for (const r of reasons) expect(isGradesGateReason(r)).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isGradesGateReason("")).toBe(false);
    expect(isGradesGateReason(null)).toBe(false);
    expect(isGradesGateReason(undefined)).toBe(false);
    expect(isGradesGateReason("OK")).toBe(false);
  });
});

describe("gateMessage", () => {
  it("returns nothing when access is granted", () => {
    expect(gateMessage("ok")).toBeNull();
  });

  it("sends delinquent representatives to the payments screen", () => {
    const msg = gateMessage("delinquent")!;
    expect(msg.actionHref).toBe("/representative/pagos");
    expect(msg.variant).toBe("destructive");
  });

  it("treats an unpublished momento as informative, not an error", () => {
    const msg = gateMessage("hidden_by_school")!;
    expect(msg.variant).toBe("default");
    expect(msg.actionHref).toBeUndefined();
  });

  it("always carries a title and a description", () => {
    for (const r of ["not_child", "blocked_by_school", "delinquent", "hidden_by_school"] as const) {
      const msg = gateMessage(r)!;
      expect(msg.title.length).toBeGreaterThan(0);
      expect(msg.description.length).toBeGreaterThan(0);
    }
  });
});
