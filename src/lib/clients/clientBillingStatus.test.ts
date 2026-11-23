import { describe, expect, it } from "vitest";
import { addDays, gridMonths, monthCellState, summarizeClientBilling, summarizeClients } from "./clientBillingStatus";

const base = { currentMonth: "2026-11-01", settledMonths: [] as string[] };

describe("summarizeClientBilling", () => {
  it("computes debt for a real client", () => {
    const snap = summarizeClientBilling({
      ...base,
      accountType: "client",
      startMonth: "2026-09-01",
      monthlyFeeUsd: 120,
      settledMonths: ["2026-09-01"],
    });
    expect(snap).toEqual({ status: "pending", pendingMonths: ["2026-10-01", "2026-11-01"], amountDueUsd: 240 });
  });

  it("is up to date when every month is settled", () => {
    const snap = summarizeClientBilling({
      ...base,
      accountType: "client",
      startMonth: "2026-11-01",
      monthlyFeeUsd: 100,
      settledMonths: ["2026-11-01"],
    });
    expect(snap.status).toBe("up_to_date");
    expect(snap.amountDueUsd).toBe(0);
  });

  it("flags real clients without fee or start month", () => {
    expect(summarizeClientBilling({ ...base, accountType: "client", startMonth: null, monthlyFeeUsd: 120 }).status).toBe(
      "not_configured",
    );
    const noFee = summarizeClientBilling({ ...base, accountType: "client", startMonth: "2026-10-01", monthlyFeeUsd: null });
    expect(noFee.status).toBe("not_configured");
    expect(noFee.amountDueUsd).toBeNull();
  });

  it("keeps demos and inactive accounts out of collections", () => {
    expect(summarizeClientBilling({ ...base, accountType: "demo", startMonth: null, monthlyFeeUsd: null }).status).toBe("demo");
    expect(
      summarizeClientBilling({ ...base, accountType: "inactive", startMonth: "2026-01-01", monthlyFeeUsd: 50 }).status,
    ).toBe("inactive");
  });
});

describe("summarizeClients", () => {
  it("adds revenue and debt of real clients and counts demos ending soon", () => {
    const pending = { status: "pending" as const, pendingMonths: ["2026-11-01"], amountDueUsd: 120 };
    const ok = { status: "up_to_date" as const, pendingMonths: [], amountDueUsd: 0 };
    const demo = { status: "demo" as const, pendingMonths: [], amountDueUsd: null };
    const overview = summarizeClients(
      [
        { accountType: "client", monthlyFeeUsd: 120, snapshot: pending, demoEndsOn: null },
        { accountType: "client", monthlyFeeUsd: 100, snapshot: ok, demoEndsOn: null },
        { accountType: "demo", monthlyFeeUsd: null, snapshot: demo, demoEndsOn: "2026-11-25" },
        { accountType: "demo", monthlyFeeUsd: null, snapshot: demo, demoEndsOn: "2027-01-10" },
        { accountType: "inactive", monthlyFeeUsd: 30, snapshot: demo, demoEndsOn: null },
      ],
      "2026-11-23",
    );
    expect(overview).toEqual({
      clients: 2,
      demos: 2,
      inactive: 1,
      monthlyRevenueUsd: 220,
      debtUsd: 120,
      clientsWithDebt: 1,
      demosEndingSoon: 1,
    });
  });

  it("handles an empty list", () => {
    expect(summarizeClients([], "2026-11-23").clients).toBe(0);
  });
});

describe("grid helpers", () => {
  it("adds days across months", () => {
    expect(addDays("2026-11-28", 7)).toBe("2026-12-05");
  });

  it("shows 5 months before the start month and months ahead", () => {
    const months = gridMonths("2026-09-01", "2026-11-01", 2);
    expect(months[0]).toBe("2026-04-01");
    expect(months[months.length - 1]).toBe("2027-01-01");
  });

  it("shows at least 5 past months when billing starts this month or later", () => {
    expect(gridMonths("2026-11-01", "2026-11-01", 0)[0]).toBe("2026-06-01");
    expect(gridMonths("2027-03-01", "2026-11-01", 0)[0]).toBe("2026-06-01");
  });

  it("never goes more than 3 years back", () => {
    expect(gridMonths("2020-01-01", "2026-11-01", 0)[0]).toBe("2023-11-01");
  });

  it("shows the last year when there is no start month", () => {
    expect(gridMonths(null, "2026-11-01", 0)).toHaveLength(12);
  });

  it("classifies months", () => {
    const settled = new Map<string, "paid" | "waived">([["2026-09-01", "paid"], ["2026-10-01", "waived"]]);
    expect(monthCellState("2026-09-01", settled, "2026-09-01", "2026-11-01")).toBe("paid");
    expect(monthCellState("2026-10-01", settled, "2026-09-01", "2026-11-01")).toBe("waived");
    expect(monthCellState("2026-11-01", settled, "2026-09-01", "2026-11-01")).toBe("pending");
    expect(monthCellState("2026-12-01", settled, "2026-09-01", "2026-11-01")).toBe("upcoming");
    expect(monthCellState("2026-08-01", settled, "2026-09-01", "2026-11-01")).toBe("past");
    expect(monthCellState("2026-05-01", settled, null, "2026-11-01")).toBe("past");
  });
});
