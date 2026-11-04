import { describe, expect, it } from "vitest";
import { defaultRegimeFor, getBeneficiaryFieldRules, missingBeneficiaryData, type BeneficiaryRecord } from "./beneficiaryRules";

const off = { vatEnabled: false, islrEnabled: false };
const on = { vatEnabled: true, islrEnabled: true };

describe("getBeneficiaryFieldRules", () => {
  it("keeps staff simple when the school has withholdings off", () => {
    const rules = getBeneficiaryFieldRules({ category: "teacher", regime: "payroll", personType: null, ...off });
    expect(rules.document).toBe("required");
    expect(rules.taxId).toBe("optional");
    expect(rules.ariRate).toBe("hidden");
    expect(rules.fiscalAddress).toBe("hidden");
  });

  it("asks staff for RIF and AR-I when ISLR is on", () => {
    const rules = getBeneficiaryFieldRules({ category: "worker", regime: "payroll", personType: null, ...on });
    expect(rules.taxId).toBe("required");
    expect(rules.ariRate).toBe("required");
  });

  it("always asks a supplier for fiscal data, even with withholdings off", () => {
    const rules = getBeneficiaryFieldRules({ category: "supplier", regime: "invoice", personType: "legal_domiciled", ...off });
    expect(rules.taxId).toBe("required");
    expect(rules.fiscalAddress).toBe("required");
    expect(rules.email).toBe("required");
    expect(rules.regimeLocked).toBe(true);
  });

  it("hides the identity card for a legal person and requires it for a natural one", () => {
    const legal = getBeneficiaryFieldRules({ category: "supplier", regime: "invoice", personType: "legal_domiciled", ...on });
    const natural = getBeneficiaryFieldRules({ category: "supplier", regime: "invoice", personType: "natural_resident", ...on });
    expect(legal.document).toBe("hidden");
    expect(natural.document).toBe("required");
  });

  it("treats a teacher paid by fees like a supplier only when withholdings are on", () => {
    const withOn = getBeneficiaryFieldRules({ category: "teacher", regime: "invoice", personType: "natural_resident", ...on });
    const withOff = getBeneficiaryFieldRules({ category: "teacher", regime: "invoice", personType: "natural_resident", ...off });
    expect(withOn.fiscalAddress).toBe("required");
    expect(withOn.islrConcept).toBe("required");
    expect(withOff.fiscalAddress).toBe("optional");
    expect(withOn.regimeLocked).toBe(false);
  });

  it("defaults the regime by category", () => {
    expect(defaultRegimeFor("supplier")).toBe("invoice");
    expect(defaultRegimeFor("teacher")).toBe("payroll");
  });
});

describe("missingBeneficiaryData", () => {
  const legacyStaff: BeneficiaryRecord = {
    category: "teacher",
    payment_regime: "payroll",
    person_type: null,
    full_name: "Ana Pérez",
    document_id: "V-12345678",
    tax_id: null,
    fiscal_address: null,
    email: null,
  };

  it("doesn't flag existing staff of a school with withholdings off", () => {
    expect(missingBeneficiaryData(legacyStaff, { ...off, hasAriRate: false })).toEqual([]);
  });

  it("flags what ISLR needs once it's on", () => {
    expect(missingBeneficiaryData(legacyStaff, { ...on, hasAriRate: false })).toEqual(["RIF", "% AR-I"]);
  });

  it("lists everything missing on a supplier", () => {
    const supplier: BeneficiaryRecord = { ...legacyStaff, category: "supplier", payment_regime: "invoice", document_id: null };
    expect(missingBeneficiaryData(supplier, { ...off, hasAriRate: false })).toEqual([
      "Cédula",
      "RIF",
      "Tipo de persona",
      "Domicilio fiscal",
      "Correo",
    ]);
  });
});
