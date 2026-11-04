import { describe, expect, it } from "vitest";
import { isDefaultIslrRate, isDefaultParameters } from "./defaultRates";
import type { IslrRateVersion, TaxParameters } from "./types";

const parameters: TaxParameters = {
  id: "p",
  school_id: "s",
  valid_from: "2026-01-01",
  vat_standard_pct: 75,
  vat_full_pct: 100,
  default_vat_rate_pct: 16,
  tax_unit_value: 43,
  petty_cash_ut_limit: 20,
};

const rate: IslrRateVersion = {
  id: "r",
  school_id: "s",
  concept_id: "c",
  person_type: "legal_domiciled",
  valid_from: "2026-01-01",
  base_pct: 100,
  rate_pct: 2,
  subtrahend_mode: "none",
  subtrahend_amount: 0,
  minimum_mode: "none",
  minimum_amount: 0,
};

describe("default rates", () => {
  it("recognizes the starting parameters", () => {
    expect(isDefaultParameters(parameters)).toBe(true);
    expect(isDefaultParameters({ ...parameters, tax_unit_value: 50 })).toBe(false);
  });

  it("flags a changed ISLR rate", () => {
    expect(isDefaultIslrRate("Contratistas y servicios", rate)).toBe(true);
    expect(isDefaultIslrRate("Contratistas y servicios", { ...rate, rate_pct: 3 })).toBe(false);
  });

  it("flags concepts or person types that aren't part of the defaults", () => {
    expect(isDefaultIslrRate("Otro concepto", rate)).toBe(false);
    expect(isDefaultIslrRate("Contratistas y servicios", { ...rate, person_type: "legal_non_domiciled" })).toBe(false);
  });
});
