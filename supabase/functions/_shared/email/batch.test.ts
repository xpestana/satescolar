import { describe, expect, it } from "vitest";
import { sendInBatches } from "./batch";

const items = (n: number) => Array.from({ length: n }, (_, i) => ({ email: `u${i}@example.com` }));

describe("sendInBatches", () => {
  it("sends everything and counts failures", async () => {
    const result = await sendInBatches(
      items(5),
      async (i) => (i.email === "u2@example.com" ? { sent: false, error: "rebote" } : { sent: true }),
      { concurrency: 2, budgetMs: 10_000 },
    );
    expect(result).toEqual({ sent: 4, failed: [{ item: "u2@example.com", error: "rebote" }], pending: 0 });
  });

  it("never runs more than `concurrency` sends at once", async () => {
    let running = 0;
    let max = 0;
    await sendInBatches(
      items(10),
      async () => {
        running++;
        max = Math.max(max, running);
        await new Promise((r) => setTimeout(r, 5));
        running--;
        return { sent: true };
      },
      { concurrency: 3, budgetMs: 10_000 },
    );
    expect(max).toBe(3);
  });

  it("stops starting new sends when the time budget runs out", async () => {
    let clock = 0;
    const result = await sendInBatches(
      items(10),
      async () => {
        clock += 40;
        return { sent: true };
      },
      { concurrency: 1, budgetMs: 100, now: () => clock },
    );
    expect(result.sent).toBe(3);
    expect(result.pending).toBe(7);
  });

  it("turns a thrown error into a failure", async () => {
    const result = await sendInBatches(items(1), async () => {
      throw new Error("boom");
    }, { concurrency: 1, budgetMs: 1000 });
    expect(result.failed).toEqual([{ item: "u0@example.com", error: "boom" }]);
  });
});
