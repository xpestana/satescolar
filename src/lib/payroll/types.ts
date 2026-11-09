// Domain types for the payroll module (Pagos de Nóminas).
// Kept framework-free so lib and hooks can share them.

import type { PaymentRegime, PersonType, VatWithholdingMode } from "./withholdings/types";

export type PayrollCategory = "teacher" | "admin" | "worker" | "supplier" | "other";
export type ConceptKind = "earning" | "deduction";
export type PayrollCurrency = "VES" | "USD";
export type PayrollPaymentStatus = "draft" | "approved" | "paid" | "voided";
export type PayrollMethodType = "transfer" | "mobile_payment" | "cash" | "check";
export type PayrollPeriodType = "biweekly" | "monthly";

export interface PayrollBeneficiary {
  id: string;
  school_id: string;
  category: PayrollCategory;
  teacher_id: string | null;
  full_name: string;
  document_id: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  is_active: boolean;
  payment_regime: PaymentRegime;
  person_type: PersonType | null;
  tax_id: string | null;
  fiscal_address: string | null;
  vat_withholding_mode: VatWithholdingMode;
  vat_exclusion_reason: string | null;
  default_islr_concept_id: string | null;
  job_title: string | null;
  hire_date: string | null;
  /** Hours a month the worker works; sets the value of an hour for unjustified absences. */
  monthly_hours: number | null;
  created_at: string;
  updated_at: string;
}

export interface PayrollPaymentMethod {
  id: string;
  school_id: string;
  beneficiary_id: string;
  method_type: PayrollMethodType;
  label: string | null;
  config: Record<string, unknown>;
  is_default: boolean;
  is_active: boolean;
}

export interface PayrollPeriod {
  id: string;
  school_id: string;
  name: string;
  period_type: PayrollPeriodType;
  start_date: string;
  end_date: string;
  status: "open" | "closed";
  school_year_id: string | null;
  /** Whether its salary payments discount withholdings and contributions. */
  apply_deductions: boolean;
}

export interface PayrollConcept {
  id: string;
  school_id: string;
  name: string;
  concept_kind: ConceptKind;
  default_amount: number;
  currency: PayrollCurrency;
  is_active: boolean;
  is_islr_taxable: boolean;
  /** Whether it counts for IVSS, paro forzoso and FAOV. */
  is_contribution_base: boolean;
  /** The base salary: unjustified absences are discounted from it by the hour. */
  is_base_salary: boolean;
  /** Filled in by default when registering a salary payment. */
  is_default: boolean;
  /** Categories it's on by default for; empty = every category. */
  default_categories: string[];
}

export interface PayrollLineItem {
  concept_id?: string | null;
  concept_kind: ConceptKind;
  description?: string | null;
  amount: number;
  /** Exact bolívares of the line (null on lines saved before it existed). */
  amount_ves?: number | null;
  /** Set on the unjustified-absence discount: the hours it discounts. */
  unpaid_hours?: number | null;
}

export interface PayrollPayment {
  id: string;
  school_id: string;
  period_id: string;
  beneficiary_id: string;
  status: PayrollPaymentStatus;
  currency: PayrollCurrency;
  exchange_rate: number;
  gross_amount: number;
  deductions_amount: number;
  net_amount: number;
  net_amount_ves: number;
  payment_method_id: string | null;
  payment_date: string | null;
  notes: string | null;
  created_at: string;
}

export const CATEGORY_LABELS: Record<PayrollCategory, string> = {
  teacher: "Docente",
  admin: "Administrativo",
  worker: "Obrero",
  supplier: "Proveedor",
  other: "Otros",
};

export const METHOD_LABELS: Record<PayrollMethodType, string> = {
  transfer: "Transferencia",
  mobile_payment: "Pago móvil",
  cash: "Efectivo",
  check: "Cheque",
};

export const STATUS_LABELS: Record<PayrollPaymentStatus, string> = {
  draft: "Borrador",
  approved: "Aprobado",
  paid: "Pagado",
  voided: "Anulado",
};
