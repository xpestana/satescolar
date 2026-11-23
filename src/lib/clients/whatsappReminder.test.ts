import { describe, expect, it } from "vitest";
import { buildWhatsAppLink, buildWhatsAppReminderText, toWhatsAppNumber } from "./whatsappReminder";

describe("toWhatsAppNumber", () => {
  it("normalizes Venezuelan numbers", () => {
    expect(toWhatsAppNumber("0414-123.45.67")).toBe("584141234567");
    expect(toWhatsAppNumber("+58 414 1234567")).toBe("584141234567");
    expect(toWhatsAppNumber("4141234567")).toBe("584141234567");
    expect(toWhatsAppNumber("0058 414 1234567")).toBe("584141234567");
  });

  it("rejects empty or too short numbers", () => {
    expect(toWhatsAppNumber(null)).toBeNull();
    expect(toWhatsAppNumber("1234")).toBeNull();
  });
});

describe("WhatsApp reminder", () => {
  it("builds a friendly text and a wa.me link", () => {
    const text = buildWhatsAppReminderText({
      contactName: "Doris",
      schoolName: "UEP Madariaga",
      pendingMonths: ["2026-10-01", "2026-11-01"],
      amountDueUsd: 240,
    });
    expect(text).toContain("Hola, Doris");
    expect(text).toContain("octubre y noviembre de 2026");
    expect(text).toContain("240,00 USD");
    expect(buildWhatsAppLink("0414-1234567", text)).toMatch(/^https:\/\/wa\.me\/584141234567\?text=Hola%2C%20Doris/);
    expect(buildWhatsAppLink("", text)).toBeNull();
  });
});
