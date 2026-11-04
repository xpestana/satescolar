// Which beneficiary fields apply and which are mandatory, by type of beneficiary. One place,
// shared by the form, its validation and the "datos incompletos" badge.

import type { PayrollCategory } from "../types";
import { isValidDocumentNumber, normalizeTaxId, parseDocumentId } from "./taxId";
import type { PaymentRegime, PersonType } from "./types";

export type FieldRule = "hidden" | "optional" | "required";

export interface BeneficiaryRuleContext {
  category: PayrollCategory;
  regime: PaymentRegime;
  personType: PersonType | "" | null;
  vatEnabled: boolean;
  islrEnabled: boolean;
}

export interface BeneficiaryFieldRules {
  document: FieldRule;
  taxId: FieldRule;
  personType: FieldRule;
  fiscalAddress: FieldRule;
  email: FieldRule;
  ariRate: FieldRule;
  vatMode: FieldRule;
  islrConcept: FieldRule;
  regimeLocked: boolean;
}

export const isLegalPerson = (personType: string | null | undefined) =>
  personType === "legal_domiciled" || personType === "legal_non_domiciled";

/** Default way of paying each category; only a supplier is fixed. */
export function defaultRegimeFor(category: PayrollCategory): PaymentRegime {
  return category === "supplier" ? "invoice" : "payroll";
}

export function getBeneficiaryFieldRules(ctx: BeneficiaryRuleContext): BeneficiaryFieldRules {
  const isSupplier = ctx.category === "supplier";
  const regimeLocked = isSupplier;

  if (ctx.regime === "payroll" && !isSupplier) {
    return {
      document: "required",
      taxId: ctx.islrEnabled ? "required" : "optional",
      personType: "hidden",
      fiscalAddress: "hidden",
      email: "optional",
      ariRate: ctx.islrEnabled ? "required" : "hidden",
      vatMode: "hidden",
      islrConcept: "hidden",
      regimeLocked,
    };
  }

  // Suppliers always give fiscal data; others billing by invoice do when withholdings are on.
  const fiscal: FieldRule = isSupplier || ctx.vatEnabled || ctx.islrEnabled ? "required" : "optional";
  return {
    document: isLegalPerson(ctx.personType) ? "hidden" : "required",
    taxId: fiscal,
    personType: fiscal,
    fiscalAddress: fiscal,
    email: fiscal,
    ariRate: "hidden",
    vatMode: fiscal,
    islrConcept: ctx.islrEnabled ? "required" : "hidden",
    regimeLocked,
  };
}

export interface BeneficiaryRecord {
  category: PayrollCategory;
  payment_regime: PaymentRegime;
  person_type: PersonType | null;
  full_name: string;
  document_id: string | null;
  tax_id: string | null;
  fiscal_address: string | null;
  email: string | null;
}

/**
 * Mandatory data still missing on a saved beneficiary. Lets existing records keep working:
 * they show a badge, and only block new payments if the school has withholdings on.
 */
export function missingBeneficiaryData(
  beneficiary: BeneficiaryRecord,
  options: { vatEnabled: boolean; islrEnabled: boolean; hasAriRate: boolean }
): string[] {
  const rules = getBeneficiaryFieldRules({
    category: beneficiary.category,
    regime: beneficiary.payment_regime,
    personType: beneficiary.person_type,
    vatEnabled: options.vatEnabled,
    islrEnabled: options.islrEnabled,
  });

  const missing: string[] = [];
  if (!beneficiary.full_name?.trim()) missing.push("Nombre");
  if (rules.document === "required") {
    const { type, number } = parseDocumentId(beneficiary.document_id);
    if (!isValidDocumentNumber(type, number)) missing.push("Cédula");
  }
  if (rules.taxId === "required" && !normalizeTaxId(beneficiary.tax_id)) missing.push("RIF");
  if (rules.personType === "required" && !beneficiary.person_type) missing.push("Tipo de persona");
  if (rules.fiscalAddress === "required" && !beneficiary.fiscal_address?.trim()) missing.push("Domicilio fiscal");
  if (rules.email === "required" && !beneficiary.email?.trim()) missing.push("Correo");
  if (rules.ariRate === "required" && !options.hasAriRate) missing.push("% AR-I");
  return missing;
}
