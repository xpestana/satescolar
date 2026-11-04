// Turns what the user typed into the lines, documents and withholdings of a payment, ready for
// the register RPC. Pure: the same builder fills the preview on screen and the saved payload,
// and it's reused when a payment is recalculated.

import { calculatePayrollTotals, convertToVes, round2 } from "../calculateNet";
import type { PayrollCurrency, PayrollLineItem } from "../types";
import { calculateAriWithholding } from "./calculateAriWithholding";
import { calculateIslrWithholding } from "./calculateIslrWithholding";
import { calculateVatWithholding } from "./calculateVatWithholding";
import { resolveRateVersion } from "./resolveRateVersion";
import type {
  AriRate,
  IslrConcept,
  IslrRateVersion,
  PersonType,
  TaxParameters,
  TaxType,
  VatWithholdingMode,
  WithholdingSource,
} from "./types";

export interface WithholdingOverride {
  pct: number;
  reason: string;
}

export interface DraftWithholding {
  key: string;
  document_key: string | null;
  tax_type: TaxType;
  source: WithholdingSource;
  base_ves: number;
  base_pct: number;
  rate_pct: number;
  tax_amount_ves: number;
  subtrahend_ves: number;
  minimum_ves: number;
  tax_unit_value: number | null;
  withheld_ves: number;
  withheld_amount: number;
  no_withholding_reason: string | null;
  islr_concept_id: string | null;
  islr_concept_name: string | null;
  islr_seniat_code: string | null;
  person_type: PersonType | null;
  parameters_version_id: string | null;
  islr_rate_version_id: string | null;
  ari_rate_id: string | null;
  is_override: boolean;
  override_reason: string | null;
}

export interface DraftItem extends PayrollLineItem {
  withholding_key?: string | null;
}

export interface DraftDocumentInput {
  key: string;
  document_type: "invoice" | "debit_note";
  document_number: string;
  control_number: string;
  issue_date: string;
  taxable_base: number;
  exempt_amount: number;
  vat_rate_pct: number;
  vat_amount: number;
  /** Only read when the invoice doesn't itemize the VAT; otherwise it's computed. */
  total_amount?: number;
  islr_concept_id: string | null;
  is_petty_cash: boolean;
  is_vat_not_itemized: boolean;
  is_non_compliant: boolean;
  vatOverride?: WithholdingOverride | null;
  islrOverride?: WithholdingOverride | null;
}

export type DraftDocument = Omit<DraftDocumentInput, "vatOverride" | "islrOverride"> & { total_amount: number };

export interface PaymentDraft {
  items: DraftItem[];
  documents: DraftDocument[];
  withholdings: DraftWithholding[];
  totals: { gross: number; deductions: number; net: number; netVes: number; withheldVes: number };
  errors: string[];
}

interface TaxContext {
  vatEnabled: boolean;
  islrEnabled: boolean;
  /** Date whose rates apply: the day of the payment. */
  date: string;
  parameters: TaxParameters[];
}

function currencyAmount(ves: number, currency: PayrollCurrency, rate: number): number {
  if (currency === "VES") return round2(ves);
  return rate > 0 ? round2(ves / rate) : 0;
}

function finish(
  items: DraftItem[],
  documents: DraftDocument[],
  withholdings: DraftWithholding[],
  currency: PayrollCurrency,
  rate: number,
  errors: string[]
): PaymentDraft {
  const totals = calculatePayrollTotals(items);
  return {
    items,
    documents,
    withholdings,
    totals: {
      ...totals,
      netVes: convertToVes(totals.net, currency, rate),
      withheldVes: round2(withholdings.reduce((sum, w) => sum + w.withheld_ves, 0)),
    },
    errors,
  };
}

const VAT_DEFAULTS = { subtrahend_ves: 0, minimum_ves: 0, base_pct: 100 };

export interface SupplierDraftInput extends TaxContext {
  currency: PayrollCurrency;
  exchangeRate: number;
  personType: PersonType | null;
  vatMode: VatWithholdingMode;
  vatExclusionReason: string | null;
  concepts: IslrConcept[];
  rates: IslrRateVersion[];
  documents: DraftDocumentInput[];
}

/** A payment to a supplier: the invoices it covers and what must be withheld from each. */
export function buildSupplierPaymentDraft(input: SupplierDraftInput): PaymentDraft {
  const { currency, exchangeRate: rate } = input;
  const errors: string[] = [];
  const items: DraftItem[] = [];
  const documents: DraftDocument[] = [];
  const withholdings: DraftWithholding[] = [];
  const parameters = resolveRateVersion(input.parameters, input.date);

  if ((input.vatEnabled || input.islrEnabled) && !parameters) {
    errors.push("No hay parámetros de retención vigentes para la fecha del pago.");
  }

  for (const doc of input.documents) {
    const base = doc.is_vat_not_itemized ? 0 : Math.max(0, doc.taxable_base || 0);
    const exempt = Math.max(0, doc.exempt_amount || 0);
    const vat = doc.is_vat_not_itemized ? 0 : Math.max(0, doc.vat_amount || 0);
    const total = round2(doc.is_vat_not_itemized ? Math.max(0, doc.total_amount || 0) : base + exempt + vat);
    const { vatOverride, islrOverride, ...docFields } = doc;
    documents.push({ ...docFields, total_amount: total });

    const label = doc.document_type === "debit_note" ? "Nota de débito" : "Factura";
    items.push({
      concept_id: null,
      concept_kind: "earning",
      description: `${label} ${doc.document_number} (control ${doc.control_number})`,
      amount: total,
    });

    let netOfVatVes = convertToVes(base + exempt, currency, rate);

    if (input.vatEnabled && parameters) {
      const result = calculateVatWithholding({
        taxableBaseVes: convertToVes(base, currency, rate),
        vatAmountVes: convertToVes(vat, currency, rate),
        totalVes: convertToVes(total, currency, rate),
        vatRatePct: doc.vat_rate_pct,
        mode: input.vatMode,
        exclusionReason: input.vatExclusionReason,
        isPettyCash: doc.is_petty_cash,
        isVatNotItemized: doc.is_vat_not_itemized,
        isNonCompliant: doc.is_non_compliant,
        standardPct: parameters.vat_standard_pct,
        fullPct: parameters.vat_full_pct,
        taxUnitValue: parameters.tax_unit_value,
        pettyCashUtLimit: parameters.petty_cash_ut_limit,
        overridePct: vatOverride?.pct ?? null,
      });
      if (doc.is_vat_not_itemized) netOfVatVes = result.baseVes;

      const key = `${doc.key}:vat`;
      const withheldAmount = currencyAmount(result.withheldVes, currency, rate);
      withholdings.push({
        ...VAT_DEFAULTS,
        key,
        document_key: doc.key,
        tax_type: "vat",
        source: "invoice",
        base_ves: result.baseVes,
        rate_pct: result.appliedPct,
        tax_amount_ves: result.taxAmountVes,
        tax_unit_value: parameters.tax_unit_value,
        withheld_ves: result.withheldVes,
        withheld_amount: withheldAmount,
        no_withholding_reason: result.noWithholdingReason,
        islr_concept_id: null,
        islr_concept_name: null,
        islr_seniat_code: null,
        person_type: input.personType,
        parameters_version_id: parameters.id,
        islr_rate_version_id: null,
        ari_rate_id: null,
        is_override: !!vatOverride,
        override_reason: vatOverride?.reason ?? null,
      });
      if (withheldAmount > 0) {
        items.push({
          concept_id: null,
          concept_kind: "deduction",
          description: `Retención IVA ${result.appliedPct} % — ${doc.document_number}`,
          amount: withheldAmount,
          withholding_key: key,
        });
      }
    }

    if (input.islrEnabled && parameters && doc.islr_concept_id) {
      const concept = input.concepts.find((c) => c.id === doc.islr_concept_id);
      const versions = input.rates.filter(
        (r) => r.concept_id === doc.islr_concept_id && r.person_type === input.personType
      );
      const version = resolveRateVersion(versions, input.date);
      if (!input.personType) {
        errors.push("Falta el tipo de persona del beneficiario.");
      } else if (!version) {
        errors.push(`No hay porcentaje de ISLR vigente para "${concept?.name ?? "el concepto"}" y este tipo de persona.`);
      } else {
        const result = calculateIslrWithholding({
          amountVes: netOfVatVes,
          rate: version,
          taxUnitValue: parameters.tax_unit_value,
          overridePct: islrOverride?.pct ?? null,
        });
        const key = `${doc.key}:islr`;
        const withheldAmount = currencyAmount(result.withheldVes, currency, rate);
        withholdings.push({
          key,
          document_key: doc.key,
          tax_type: "islr",
          source: "invoice",
          base_ves: result.baseVes,
          base_pct: result.basePct,
          rate_pct: result.appliedPct,
          tax_amount_ves: 0,
          subtrahend_ves: result.subtrahendVes,
          minimum_ves: result.minimumVes,
          tax_unit_value: parameters.tax_unit_value,
          withheld_ves: result.withheldVes,
          withheld_amount: withheldAmount,
          no_withholding_reason: result.noWithholdingReason,
          islr_concept_id: doc.islr_concept_id,
          islr_concept_name: concept?.name ?? null,
          islr_seniat_code: concept?.seniat_code ?? null,
          person_type: input.personType,
          parameters_version_id: parameters.id,
          islr_rate_version_id: version.id,
          ari_rate_id: null,
          is_override: !!islrOverride,
          override_reason: islrOverride?.reason ?? null,
        });
        if (withheldAmount > 0) {
          items.push({
            concept_id: null,
            concept_kind: "deduction",
            description: `Retención ISLR ${result.appliedPct} % — ${doc.document_number}`,
            amount: withheldAmount,
            withholding_key: key,
          });
        }
      }
    }
  }

  return finish(items, documents, withholdings, currency, rate, errors);
}

export interface SalaryLine extends PayrollLineItem {
  /** Whether it counts for the AR-I base. Lines without a concept count by default. */
  isTaxable: boolean;
}

export interface SalaryDraftInput extends TaxContext {
  currency: PayrollCurrency;
  exchangeRate: number;
  lines: SalaryLine[];
  ariRates: AriRate[];
}

/** A salary payment: the typed lines plus the automatic AR-I line when ISLR is on. */
export function buildSalaryPaymentDraft(input: SalaryDraftInput): PaymentDraft {
  const { currency, exchangeRate: rate } = input;
  const errors: string[] = [];
  const items: DraftItem[] = input.lines.map(({ isTaxable: _isTaxable, ...line }) => line);
  const withholdings: DraftWithholding[] = [];

  if (input.islrEnabled) {
    const parameters = resolveRateVersion(input.parameters, input.date);
    const ari = resolveRateVersion(input.ariRates, input.date);
    if (!ari) {
      errors.push("Este trabajador no tiene un % de AR-I vigente. Regístrelo en su ficha.");
    } else {
      const taxable = input.lines
        .filter((l) => l.concept_kind === "earning" && l.isTaxable)
        .reduce((sum, l) => sum + Math.max(0, l.amount || 0), 0);
      const result = calculateAriWithholding({
        taxableEarningsVes: convertToVes(taxable, currency, rate),
        ariPct: ari.rate_pct,
      });
      const withheldAmount = currencyAmount(result.withheldVes, currency, rate);
      withholdings.push({
        key: "salary:islr",
        document_key: null,
        tax_type: "islr",
        source: "salary",
        base_ves: result.baseVes,
        base_pct: 100,
        rate_pct: result.appliedPct,
        tax_amount_ves: 0,
        subtrahend_ves: 0,
        minimum_ves: 0,
        tax_unit_value: parameters?.tax_unit_value ?? null,
        withheld_ves: result.withheldVes,
        withheld_amount: withheldAmount,
        no_withholding_reason: result.noWithholdingReason,
        islr_concept_id: null,
        islr_concept_name: "Sueldos y salarios",
        islr_seniat_code: null,
        person_type: "natural_resident",
        parameters_version_id: null,
        islr_rate_version_id: null,
        ari_rate_id: ari.id,
        is_override: false,
        override_reason: null,
      });
      if (withheldAmount > 0) {
        items.push({
          concept_id: null,
          concept_kind: "deduction",
          description: `Retención ISLR (AR-I ${result.appliedPct} %)`,
          amount: withheldAmount,
          withholding_key: "salary:islr",
        });
      }
    }
  }

  return finish(items, [], withholdings, currency, rate, errors);
}
