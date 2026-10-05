import { describe, it, expect } from "vitest";
import { buildModuleContactMessage, buildWhatsappUrl, SALES_WHATSAPP_PHONE } from "./salesContact";

describe("buildWhatsappUrl", () => {
  it("strips non-digits from the phone and encodes the message", () => {
    const url = buildWhatsappUrl("+58 412-074 3558", "Hola 👋 ¿info?");
    expect(url.startsWith("https://wa.me/584120743558?text=")).toBe(true);
    expect(decodeURIComponent(url.split("text=")[1])).toBe("Hola 👋 ¿info?");
  });

  it("encodes characters that would break the query string", () => {
    const url = buildWhatsappUrl(SALES_WHATSAPP_PHONE, "a&b=c #d");
    expect(url).toBe("https://wa.me/584120743558?text=a%26b%3Dc%20%23d");
  });
});

describe("buildModuleContactMessage", () => {
  it("includes the school and module when activating", () => {
    const msg = buildModuleContactMessage({ moduleName: "Pagos", schoolName: "  U.E. Bolívar " });
    expect(msg).toContain("*U.E. Bolívar*");
    expect(msg).toContain("activar el módulo *Pagos*");
  });

  it("omits the school when it is unknown", () => {
    const msg = buildModuleContactMessage({ moduleName: "Pagos", schoolName: null });
    expect(msg).not.toContain("soy de");
    expect(msg.startsWith("Hola 👋. Me interesa")).toBe(true);
  });

  it("asks for a renewal when the module expired", () => {
    const msg = buildModuleContactMessage({ moduleName: "Aula Virtual", schoolName: "Colegio X", expired: true });
    expect(msg).toContain("renovar el módulo *Aula Virtual*");
  });
});
