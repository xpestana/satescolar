import { describe, expect, it } from "vitest";
import { isBornAbroad } from "./birthCountry";

describe("isBornAbroad", () => {
  it("es extranjero si el país de nacimiento no es Venezuela", () => {
    expect(isBornAbroad({ pais_nacimiento: "Colombia" })).toBe(true);
    expect(isBornAbroad({ pais_nacimiento: "España" })).toBe(true);
  });

  it("Venezuela, en cualquier forma, no es extranjero", () => {
    expect(isBornAbroad({ pais_nacimiento: "Venezuela" })).toBe(false);
    expect(isBornAbroad({ pais_nacimiento: " VENEZUELA " })).toBe(false);
    expect(isBornAbroad({ pais_nacimiento: "República Bolivariana de Venezuela" })).toBe(false);
  });

  it("sin país de nacimiento se asume Venezuela, como el formulario", () => {
    expect(isBornAbroad({})).toBe(false);
    expect(isBornAbroad({ pais_nacimiento: "" })).toBe(false);
    expect(isBornAbroad({ pais_nacimiento: null })).toBe(false);
  });
});
