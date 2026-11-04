import type { IslrRateVersion, PersonType, TaxParameters } from "./types";

// Starting values of `ensure_payroll_tax_defaults`. Settings flag anything different from these.
export const DEFAULT_PARAMETERS = {
  vat_standard_pct: 75,
  vat_full_pct: 100,
  default_vat_rate_pct: 16,
  tax_unit_value: 43,
  petty_cash_ut_limit: 20,
};

const DEFAULT_ISLR_RATES: Record<string, Partial<Record<PersonType, number>>> = {
  "Honorarios profesionales": { natural_resident: 3, legal_domiciled: 5 },
  "Contratistas y servicios": { natural_resident: 1, legal_domiciled: 2 },
  "Arrendamiento de bienes muebles": { natural_resident: 3, legal_domiciled: 5 },
  "Publicidad y propaganda": { natural_resident: 3, legal_domiciled: 5 },
};

export function isDefaultParameters(parameters: TaxParameters): boolean {
  return (Object.keys(DEFAULT_PARAMETERS) as (keyof typeof DEFAULT_PARAMETERS)[]).every(
    (key) => Number(parameters[key]) === DEFAULT_PARAMETERS[key]
  );
}

export function isDefaultIslrRate(conceptName: string, rate: IslrRateVersion): boolean {
  const expected = DEFAULT_ISLR_RATES[conceptName]?.[rate.person_type];
  return expected !== undefined && Number(rate.rate_pct) === expected;
}
