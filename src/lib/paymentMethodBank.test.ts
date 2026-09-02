import { describe, it, expect } from "vitest";
import { bankNameForMethod, resolveBankOnMethodChange } from "./paymentMethodBank";

const options = [
  { value: "m1", config: { bank_name: "Banco Provincial, S.A. Banco Universal", account_number: "01080000009061" } },
  { value: "m2", config: { bank_name: "Banesco, S.A. Banco Universal" } },
  { value: "efectivo", config: {} },
];

describe("bankNameForMethod", () => {
  it("devuelve el banco configurado", () => {
    expect(bankNameForMethod(options, "m2")).toBe("Banesco, S.A. Banco Universal");
  });
  it("vacío si el método no tiene banco o no existe", () => {
    expect(bankNameForMethod(options, "efectivo")).toBe("");
    expect(bankNameForMethod(options, "nope")).toBe("");
  });
});

describe("resolveBankOnMethodChange", () => {
  it("autocompleta cuando el campo está vacío", () => {
    expect(resolveBankOnMethodChange(options, "m1", "m2", "")).toBe("Banesco, S.A. Banco Universal");
  });
  it("reemplaza el banco autocompletado del método anterior", () => {
    expect(resolveBankOnMethodChange(options, "m1", "m2", "Banco Provincial, S.A. Banco Universal"))
      .toBe("Banesco, S.A. Banco Universal");
  });
  it("respeta un banco escrito a mano", () => {
    expect(resolveBankOnMethodChange(options, "m1", "m2", "Banco del Tesoro")).toBe("Banco del Tesoro");
  });
  it("limpia el autocompletado si el nuevo método no tiene banco", () => {
    expect(resolveBankOnMethodChange(options, "m1", "efectivo", "Banco Provincial, S.A. Banco Universal")).toBe("");
  });
});
