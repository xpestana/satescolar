// Domain types for IVA / ISLR withholdings. Framework-free so calculators stay pure.

export type TaxType = "vat" | "islr";
export type WithholdingSource = "invoice" | "salary";
export type WithholdingStatus = "calculated" | "issued" | "declared" | "remitted" | "voided";
export type PaymentRegime = "payroll" | "invoice";
export type PersonType =
  | "natural_resident"
  | "natural_non_resident"
  | "legal_domiciled"
  | "legal_non_domiciled";
export type VatWithholdingMode = "standard" | "full" | "excluded";
export type AmountMode = "auto" | "manual" | "none";

export interface VersionedRow {
  id: string;
  valid_from: string;
}

export interface TaxParameters extends VersionedRow {
  school_id: string;
  vat_standard_pct: number;
  vat_full_pct: number;
  default_vat_rate_pct: number;
  tax_unit_value: number;
  petty_cash_ut_limit: number;
  created_at?: string;
}

export interface IslrRateVersion extends VersionedRow {
  school_id: string;
  concept_id: string;
  person_type: PersonType;
  base_pct: number;
  rate_pct: number;
  subtrahend_mode: AmountMode;
  subtrahend_amount: number;
  minimum_mode: AmountMode;
  minimum_amount: number;
  created_at?: string;
}

export interface IslrConcept {
  id: string;
  school_id: string;
  name: string;
  seniat_code: string | null;
  is_active: boolean;
  display_order: number;
}

export interface AriRate extends VersionedRow {
  school_id: string;
  beneficiary_id: string;
  rate_pct: number;
}

export interface TaxSettings {
  school_id: string;
  vat_agent_enabled: boolean;
  islr_agent_enabled: boolean;
  next_vat_voucher_seq: number;
  next_islr_voucher_seq: number;
  rates_validated_at: string | null;
}

export const PERSON_TYPE_LABELS: Record<PersonType, string> = {
  natural_resident: "Persona natural residente",
  natural_non_resident: "Persona natural no residente",
  legal_domiciled: "Persona jurídica domiciliada",
  legal_non_domiciled: "Persona jurídica no domiciliada",
};

export const VAT_MODE_LABELS: Record<VatWithholdingMode, string> = {
  standard: "Estándar",
  full: "Sujeto al 100 %",
  excluded: "Excluido de retención",
};

export const WITHHOLDING_STATUS_LABELS: Record<WithholdingStatus, string> = {
  calculated: "Calculada",
  issued: "Emitida",
  declared: "Declarada",
  remitted: "Enterada",
  voided: "Anulada",
};

export const TAX_TYPE_LABELS: Record<TaxType, string> = {
  vat: "IVA",
  islr: "ISLR",
};
