import { describe, expect, it } from "vitest";
import { buildBulkEnvelopes, chunk, parseRecipients } from "./bulkRecipients";

describe("parseRecipients", () => {
  it("accepts arrays and comma/semicolon strings, trimming, lowercasing and de-duplicating", () => {
    expect(parseRecipients([" A@Example.com", "a@example.com", "b@example.com"]).valid).toEqual([
      "a@example.com",
      "b@example.com",
    ]);
    expect(parseRecipients("a@example.com, b@example.com; c@example.com").valid).toEqual([
      "a@example.com",
      "b@example.com",
      "c@example.com",
    ]);
  });

  it("separates invalid addresses", () => {
    expect(parseRecipients(["ok@example.com", "sin-arroba", "x@y"])).toEqual({
      valid: ["ok@example.com"],
      invalid: ["sin-arroba", "x@y"],
    });
  });

  it("ignores empty values and non-string input", () => {
    expect(parseRecipients(["", "  ", 3 as unknown as string])).toEqual({ valid: [], invalid: [] });
    expect(parseRecipients(undefined)).toEqual({ valid: [], invalid: [] });
  });
});

describe("chunk", () => {
  it("splits in batches of the given size", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([]);
  });

  it("rejects a size below 1", () => {
    expect(() => chunk([1], 0)).toThrow();
  });
});

describe("buildBulkEnvelopes", () => {
  const sender = "no-reply@satescolar.com";

  it("never puts several recipients in the visible To header (privacy bug)", () => {
    const recipients = Array.from({ length: 120 }, (_, i) => `f${i}@example.com`);
    const envelopes = buildBulkEnvelopes(recipients, sender, 50);
    expect(envelopes).toHaveLength(3);
    for (const e of envelopes) expect(e.to).toEqual([sender]);
    expect(envelopes.flatMap((e) => e.bcc ?? [])).toEqual(recipients);
  });

  it("sends a single recipient directly", () => {
    expect(buildBulkEnvelopes(["a@example.com"], sender)).toEqual([{ to: ["a@example.com"] }]);
  });

  it("returns nothing for no recipients", () => {
    expect(buildBulkEnvelopes([], sender)).toEqual([]);
  });
});
