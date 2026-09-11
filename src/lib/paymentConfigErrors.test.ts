import { describe, expect, it } from "vitest";
import { friendlyPaymentConfigError, HAS_HISTORY_MESSAGE } from "./paymentConfigErrors";

describe("friendlyPaymentConfigError", () => {
  it("translates a foreign-key violation into the history message", () => {
    expect(friendlyPaymentConfigError({ code: "23503", message: "update or delete violates…" })).toBe(HAS_HISTORY_MESSAGE);
  });

  it("keeps the database message for other errors (e.g. year mismatch guard)", () => {
    expect(friendlyPaymentConfigError({ code: "23514", message: "El plan de pago pertenece a otro año escolar" }))
      .toBe("El plan de pago pertenece a otro año escolar");
  });

  it("uses the message of a plain Error", () => {
    expect(friendlyPaymentConfigError(new Error("Nombre requerido"))).toBe("Nombre requerido");
  });

  it("accepts strings", () => {
    expect(friendlyPaymentConfigError("falló")).toBe("falló");
  });

  it("falls back for empty or unknown values", () => {
    expect(friendlyPaymentConfigError(null)).toBe("Ocurrió un error inesperado");
    expect(friendlyPaymentConfigError(undefined)).toBe("Ocurrió un error inesperado");
    expect(friendlyPaymentConfigError({})).toBe("Ocurrió un error inesperado");
    expect(friendlyPaymentConfigError("")).toBe("Ocurrió un error inesperado");
  });
});
