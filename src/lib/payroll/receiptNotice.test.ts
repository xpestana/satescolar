import { describe, expect, it } from "vitest";
import { receiptNotice } from "./receiptNotice";

describe("receiptNotice", () => {
  it("confirma el envío solo cuando se envió", () => {
    expect(receiptNotice(true, null)).toBe("Se envió el recibo por correo.");
  });

  it("no dice que se envió si la persona no tiene correo", () => {
    expect(receiptNotice(false, "no-email")).toBe("No tiene correo registrado, así que no se envió el recibo.");
  });

  it("avisa del fallo cuando el envío falla", () => {
    expect(receiptNotice(false, "error")).toBe("No se pudo enviar el recibo por correo.");
  });
});
