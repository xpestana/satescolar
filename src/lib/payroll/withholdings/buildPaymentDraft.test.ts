import { describe, expect, it } from "vitest";
import { buildSalaryPaymentDraft, buildSupplierPaymentDraft, type DraftDocumentInput, type SupplierDraftInput } from "./buildPaymentDraft";
import type { IslrRateVersion, TaxParameters } from "./types";

const parameters: TaxParameters = {
  id: "p1",
  school_id: "s",
  valid_from: "2026-01-01",
  vat_standard_pct: 75,
  vat_full_pct: 100,
  default_vat_rate_pct: 16,
  tax_unit_value: 43,
  petty_cash_ut_limit: 20,
};

const contractorRate: IslrRateVersion = {
  id: "r1",
  school_id: "s",
  concept_id: "c1",
  person_type: "legal_domiciled",
  valid_from: "2026-01-01",
  base_pct: 100,
  rate_pct: 2,
  subtrahend_mode: "none",
  subtrahend_amount: 0,
  minimum_mode: "none",
  minimum_amount: 0,
};

const invoice: DraftDocumentInput = {
  key: "d1",
  document_type: "invoice",
  document_number: "0001",
  control_number: "00-0001",
  issue_date: "2026-11-01",
  taxable_base: 1000,
  exempt_amount: 0,
  vat_rate_pct: 16,
  vat_amount: 160,
  islr_concept_id: "c1",
  is_petty_cash: false,
  is_vat_not_itemized: false,
  is_non_compliant: false,
};

const supplierInput: SupplierDraftInput = {
  vatEnabled: true,
  islrEnabled: true,
  date: "2026-11-04",
  parameters: [parameters],
  currency: "VES",
  exchangeRate: 1,
  personType: "legal_domiciled",
  vatMode: "standard",
  vatExclusionReason: null,
  concepts: [{ id: "c1", school_id: "s", name: "Contratistas", seniat_code: null, is_active: true, display_order: 1 }],
  rates: [contractorRate],
  documents: [invoice],
};

describe("buildSupplierPaymentDraft", () => {
  it("matches the agreed example: 1.160 − 120 − 20 = 1.020", () => {
    const draft = buildSupplierPaymentDraft(supplierInput);
    expect(draft.errors).toEqual([]);
    expect(draft.totals).toMatchObject({ gross: 1160, deductions: 140, net: 1020, netVes: 1020, withheldVes: 140 });
    expect(draft.withholdings.map((w) => [w.tax_type, w.rate_pct, w.withheld_ves])).toEqual([
      ["vat", 75, 120],
      ["islr", 2, 20],
    ]);
  });

  it("links each deduction line to its withholding", () => {
    const draft = buildSupplierPaymentDraft(supplierInput);
    const lines = draft.items.filter((i) => i.concept_kind === "deduction");
    expect(lines.map((l) => [l.withholding_key, l.amount])).toEqual([
      ["d1:vat", 120],
      ["d1:islr", 20],
    ]);
  });

  it("keeps a copy of what it used, so later rate changes can't alter it", () => {
    const [vat, islr] = buildSupplierPaymentDraft(supplierInput).withholdings;
    expect(vat.parameters_version_id).toBe("p1");
    expect(islr.islr_rate_version_id).toBe("r1");
    expect(islr.islr_concept_name).toBe("Contratistas");
    expect(islr.tax_unit_value).toBe(43);
  });

  it("applies the version in force on the payment date", () => {
    const newer: IslrRateVersion = { ...contractorRate, id: "r2", valid_from: "2026-12-01", rate_pct: 4 };
    const input = { ...supplierInput, rates: [contractorRate, newer] };
    expect(buildSupplierPaymentDraft(input).withholdings[1].withheld_ves).toBe(20);
    expect(buildSupplierPaymentDraft({ ...input, date: "2026-12-01" }).withholdings[1].withheld_ves).toBe(40);
  });

  it("handles several invoices in one payment", () => {
    const draft = buildSupplierPaymentDraft({
      ...supplierInput,
      documents: [invoice, { ...invoice, key: "d2", document_number: "0002", taxable_base: 500, vat_amount: 80 }],
    });
    expect(draft.documents).toHaveLength(2);
    expect(draft.totals.gross).toBe(1740);
    expect(draft.totals.withheldVes).toBe(210);
    expect(draft.totals.net).toBe(1530);
  });

  it("computes in bolivars and deducts the equivalent on USD payments", () => {
    const draft = buildSupplierPaymentDraft({
      ...supplierInput,
      currency: "USD",
      exchangeRate: 100,
      documents: [{ ...invoice, taxable_base: 10, vat_amount: 1.6 }],
    });
    const [vat, islr] = draft.withholdings;
    expect(vat.withheld_ves).toBe(120);
    expect(vat.withheld_amount).toBe(1.2);
    expect(islr.withheld_ves).toBe(20);
    expect(islr.withheld_amount).toBe(0.2);
    expect(draft.totals.net).toBe(10.2);
    expect(draft.totals.netVes).toBe(1020);
  });

  it("uses the amount without VAT as the ISLR base when VAT isn't itemized", () => {
    const draft = buildSupplierPaymentDraft({
      ...supplierInput,
      documents: [{ ...invoice, is_vat_not_itemized: true, total_amount: 1160, taxable_base: 0, vat_amount: 0 }],
    });
    const [vat, islr] = draft.withholdings;
    expect(vat.withheld_ves).toBe(160);
    expect(islr.base_ves).toBe(1000);
    expect(islr.withheld_ves).toBe(20);
    expect(draft.totals.gross).toBe(1160);
  });

  it("records why nothing was withheld, without a deduction line", () => {
    const draft = buildSupplierPaymentDraft({ ...supplierInput, vatMode: "excluded", vatExclusionReason: "Formal" });
    const vat = draft.withholdings[0];
    expect(vat.withheld_ves).toBe(0);
    expect(vat.no_withholding_reason).toBe("Formal");
    expect(draft.items.some((i) => i.withholding_key === "d1:vat")).toBe(false);
  });

  it("skips ISLR when the invoice has no concept (goods)", () => {
    const draft = buildSupplierPaymentDraft({ ...supplierInput, documents: [{ ...invoice, islr_concept_id: null }] });
    expect(draft.withholdings.map((w) => w.tax_type)).toEqual(["vat"]);
    expect(draft.errors).toEqual([]);
  });

  it("marks one-off percentages with their reason", () => {
    const draft = buildSupplierPaymentDraft({
      ...supplierInput,
      documents: [{ ...invoice, vatOverride: { pct: 100, reason: "Indicado por el contador" } }],
    });
    expect(draft.withholdings[0]).toMatchObject({ is_override: true, rate_pct: 100, override_reason: "Indicado por el contador" });
    expect(draft.documents[0]).not.toHaveProperty("vatOverride");
  });

  it("reports missing configuration instead of guessing", () => {
    expect(buildSupplierPaymentDraft({ ...supplierInput, rates: [] }).errors[0]).toMatch(/porcentaje de ISLR/);
    expect(buildSupplierPaymentDraft({ ...supplierInput, parameters: [] }).errors[0]).toMatch(/parámetros/);
  });

  it("registers the invoice without withholdings when the school has them off", () => {
    const draft = buildSupplierPaymentDraft({ ...supplierInput, vatEnabled: false, islrEnabled: false, parameters: [] });
    expect(draft.errors).toEqual([]);
    expect(draft.withholdings).toEqual([]);
    expect(draft.totals.net).toBe(1160);
  });
});

describe("buildSalaryPaymentDraft", () => {
  const ariRate = { id: "a1", school_id: "s", beneficiary_id: "b", valid_from: "2026-01-01", rate_pct: 2 };
  const salaryInput = {
    vatEnabled: true,
    islrEnabled: true,
    date: "2026-11-04",
    parameters: [parameters],
    currency: "VES" as const,
    exchangeRate: 1,
    ariRates: [ariRate],
    lines: [
      { concept_kind: "earning" as const, description: "Sueldo", amount: 10000, isTaxable: true },
      { concept_kind: "earning" as const, description: "Bono", amount: 2000, isTaxable: false },
      { concept_kind: "deduction" as const, description: "Préstamo", amount: 500, isTaxable: true },
    ],
  };

  it("adds the AR-I line over taxable earnings only", () => {
    const draft = buildSalaryPaymentDraft(salaryInput);
    expect(draft.withholdings[0]).toMatchObject({ source: "salary", base_ves: 10000, rate_pct: 2, withheld_ves: 200, ari_rate_id: "a1" });
    expect(draft.totals).toMatchObject({ gross: 12000, deductions: 700, net: 11300 });
  });

  it("doesn't leak form-only fields into the saved lines", () => {
    expect(buildSalaryPaymentDraft(salaryInput).items[0]).not.toHaveProperty("isTaxable");
  });

  it("asks for the AR-I when it's missing", () => {
    expect(buildSalaryPaymentDraft({ ...salaryInput, ariRates: [] }).errors[0]).toMatch(/AR-I/);
  });

  it("leaves payroll exactly as today when ISLR is off", () => {
    const draft = buildSalaryPaymentDraft({ ...salaryInput, islrEnabled: false, ariRates: [] });
    expect(draft.withholdings).toEqual([]);
    expect(draft.errors).toEqual([]);
    expect(draft.totals.net).toBe(11500);
  });
});
