import { describe, expect, it } from "vitest";
import { buildReminderEmail, buildThanksEmail } from "./billingEmails";

describe("buildReminderEmail", () => {
  it("lists the pending months, the total and the payment details", () => {
    const { subject, html } = buildReminderEmail({
      schoolName: "U.E. Colegio <Demo>",
      contactName: "Doris",
      pendingMonths: ["2026-11-01", "2026-10-01"],
      monthlyFeeUsd: 120,
      paymentInstructions: "Pago móvil 0414-0000000\nBanco de Venezuela",
      contactPhone: "+58 414 0000000",
    });
    expect(subject).toBe("Recordatorio de pago SAT Escolar - octubre y noviembre de 2026");
    expect(html).toContain("Hola, Doris:");
    expect(html).toContain("U.E. Colegio &lt;Demo&gt;");
    expect(html).toContain("octubre 2026");
    expect(html).toContain("noviembre 2026");
    expect(html).toContain("240,00 USD");
    expect(html).toContain("Pago móvil 0414-0000000<br>Banco de Venezuela");
    expect(html).toContain("+58 414 0000000");
  });

  it("works without fee, instructions or contact name", () => {
    const { html } = buildReminderEmail({ schoolName: "Colegio X", pendingMonths: ["2026-11-01"] });
    expect(html).toContain("Estimado equipo de Colegio X:");
    expect(html).toContain("pendiente el siguiente mes");
    expect(html).not.toContain("Total pendiente");
    expect(html).not.toContain("Datos para el pago");
  });
});

describe("buildThanksEmail", () => {
  it("thanks for the paid months and says the account is up to date", () => {
    const { subject, html } = buildThanksEmail({ schoolName: "Colegio X", paidMonths: ["2026-10-01", "2026-11-01"] });
    expect(subject).toBe("Gracias por su pago - octubre y noviembre de 2026");
    expect(html).toContain("Su cuenta queda al día");
    expect(html).toContain("educación en nuestro país");
  });

  it("mentions months still pending", () => {
    const { html } = buildThanksEmail({
      schoolName: "Colegio X",
      paidMonths: ["2026-10-01"],
      remainingMonths: ["2026-11-01"],
    });
    expect(html).toContain("aún queda pendiente: noviembre de 2026");
  });
});
