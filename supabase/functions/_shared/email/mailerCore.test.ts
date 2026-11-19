import { describe, expect, it, vi } from "vitest";
import { asciiSubject, buildTransportMessage, createMailer, type MailerConfig, type TransportMessage } from "./mailerCore";

const config: MailerConfig = {
  host: "smtp.example.com",
  user: "u",
  pass: "p",
  fromEmail: "no-reply@satescolar.com",
  fromName: "SAT Escolar",
};

describe("asciiSubject", () => {
  it("removes accents and normalizes dashes (avoids the corrupted RFC 2047 subjects)", () => {
    expect(asciiSubject("Recordatorio – Pago de Rodríguez ¿Ñandú?")).toBe("Recordatorio - Pago de Rodriguez Nandu?");
  });

  it("keeps ASCII subjects untouched apart from spacing", () => {
    expect(asciiSubject("  Bienvenido a  Colegio Demo - SAT Escolar ")).toBe("Bienvenido a Colegio Demo - SAT Escolar");
  });
});

describe("buildTransportMessage", () => {
  it("sets sender, anti-tracking headers, ASCII subject, BCC and attachments", () => {
    const msg = buildTransportMessage(
      {
        to: ["no-reply@satescolar.com"],
        bcc: ["a@example.com", "b@example.com"],
        subject: "Información",
        html: "<p>x</p>",
        attachments: [{ filename: "r.pdf", content: "JVBERi0=", contentType: "application/pdf" }],
      },
      config,
    );
    expect(msg.from).toBe("SAT Escolar <no-reply@satescolar.com>");
    expect(msg.subject).toBe("Informacion");
    expect(msg.bcc).toEqual(["a@example.com", "b@example.com"]);
    expect(msg.headers["X-Mailgun-Track-Clicks"]).toBe("no");
    expect(msg.attachments).toEqual([
      { filename: "r.pdf", content: "JVBERi0=", encoding: "base64", contentType: "application/pdf" },
    ]);
    expect(msg.html).toBe("<p>x</p>");
  });

  it("sends plain text as content and omits empty BCC", () => {
    const msg = buildTransportMessage({ to: ["a@example.com"], bcc: [], subject: "S", text: "hola" }, config);
    expect(msg.content).toBe("hola");
    expect(msg.bcc).toBeUndefined();
    expect(msg.html).toBeUndefined();
  });
});

describe("createMailer", () => {
  it("sends through the transport and reports success", async () => {
    const transport = vi.fn(async (_m: TransportMessage) => {});
    const mailer = createMailer(transport, () => config);
    await expect(mailer.send({ to: ["a@example.com"], subject: "S", html: "x" })).resolves.toEqual({ sent: true });
    expect(transport).toHaveBeenCalledOnce();
    expect(mailer.isConfigured()).toBe(true);
    expect(mailer.senderAddress()).toBe("no-reply@satescolar.com");
  });

  it("never throws: returns the transport error", async () => {
    const mailer = createMailer(async () => {
      throw new Error("535 auth failed");
    }, () => config);
    await expect(mailer.send({ to: ["a@example.com"], subject: "S", html: "x" })).resolves.toEqual({
      sent: false,
      error: "535 auth failed",
    });
  });

  it("does not call the transport when SMTP is not configured or there are no recipients", async () => {
    const transport = vi.fn();
    const unconfigured = createMailer(transport, () => ({ ...config, pass: "" }));
    await expect(unconfigured.send({ to: ["a@example.com"], subject: "S" })).resolves.toEqual({
      sent: false,
      error: "SMTP no configurado",
    });
    expect(unconfigured.isConfigured()).toBe(false);
    const mailer = createMailer(transport, () => config);
    await expect(mailer.send({ to: [], subject: "S" })).resolves.toMatchObject({ sent: false });
    expect(transport).not.toHaveBeenCalled();
  });

  it("gives up after the timeout", async () => {
    const mailer = createMailer(() => new Promise(() => {}), () => ({ ...config, timeoutMs: 20 }));
    const result = await mailer.send({ to: ["a@example.com"], subject: "S", html: "x" });
    expect(result.sent).toBe(false);
    expect(result.error).toMatch(/no respondió/);
  });
});
