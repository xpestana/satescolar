// Turns what the user typed into the lines, documents and withholdings of a payment, ready for
// the register RPC. Pure: the same builder fills the preview on screen and the saved payload,
// and it's reused when a payment is recalculated.

import { calculatePayrollTotals, convertToVes, round2 } from "../calculateNet";
import type { PayrollCurrency, PayrollLineItem } from "../types";
import { calculateContributions } from "../contributions/calculateContributions";
import type { PriorPayment } from "../contributions/monthBase";
import {
  CONTRIBUTION_LABELS,
  type ContributionKind,
  type ContributionMethod,
  type ContributionParameters,
} from "../contributions/types";
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
  contribution_key?: string | null;
}

export interface DraftContribution {
  key: string;
  kind: ContributionKind;
  method: ContributionMethod;
  month_base_ves: number;
  capped_base_ves: number;
  cap_wages: number;
  minimum_wage_ves: number;
  rate_pct: number;
  mondays: number | null;
  month_total_ves: number;
  previously_deducted_ves: number;
  amount_ves: number;
  amount: number;
  parameters_version_id: string;
}

/** How a discounting salary payment built its bases from the month. */
export interface MonthBaseSummary {
  /** This payment's own earnings, in VES. */
  ownIslrVes: number;
  ownContributionVes: number;
  /** Earlier payments of the month that were summed. */
  prior: PriorPayment[];
  islrBaseVes: number;
  contributionBaseVes: number;
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
  contributions: DraftContribution[];
  totals: { gross: number; deductions: number; net: number; netVes: number; withheldVes: number };
  errors: string[];
  /** Salary payments in a discounting period: the earlier payments of the month it summed. */
  monthBasePaymentIds: string[] | null;
  monthBase: MonthBaseSummary | null;
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
  errors: string[],
  salary: Pick<PaymentDraft, "contributions" | "monthBasePaymentIds" | "monthBase"> = {
    contributions: [],
    monthBasePaymentIds: null,
    monthBase: null,
  }
): PaymentDraft {
  const totals = calculatePayrollTotals(items);
  return {
    items,
    documents,
    withholdings,
    ...salary,
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
  /** Whether it counts for contributions. Lines without a concept count by default. */
  isContributionBase?: boolean;
}

export interface SalaryDraftInput extends TaxContext {
  currency: PayrollCurrency;
  exchangeRate: number;
  lines: SalaryLine[];
  ariRates: AriRate[];
  /** The period's choice. When false the payment is paid in full: no AR-I, no contributions. */
  applyDeductions?: boolean;
  /** The period's end; sets the month that is summed. Defaults to the payment date. */
  monthDate?: string;
  /** Earlier live payments of the worker in the same month. */
  priorPayments?: PriorPayment[];
  contributionsEnabled?: boolean;
  contributionParameters?: ContributionParameters[];
}

const pctLabel = (pct: number) => `${String(pct).replace(".", ",")} %`;

/**
 * A salary payment: the typed lines plus the automatic AR-I and contribution lines.
 * In a discounting period the bases cover the whole month: earlier payments of the month that
 * didn't discount are added to the AR-I base, and contributions discount what the month owes
 * minus what earlier payments already discounted.
 */
export function buildSalaryPaymentDraft(input: SalaryDraftInput): PaymentDraft {
  const { currency, exchangeRate: rate } = input;
  const errors: string[] = [];
  const items: DraftItem[] = input.lines.map(({ isTaxable: _t, isContributionBase: _c, ...line }) => line);
  const withholdings: DraftWithholding[] = [];
  const contributions: DraftContribution[] = [];
  const applyDeductions = input.applyDeductions ?? true;

  if (!applyDeductions) {
    return finish(items, [], withholdings, currency, rate, errors, {
      contributions,
      monthBasePaymentIds: null,
      monthBase: null,
    });
  }

  const prior = input.priorPayments ?? [];
  const earnings = input.lines.filter((l) => l.concept_kind === "earning");
  const ownIslrVes = round2(
    convertToVes(earnings.filter((l) => l.isTaxable).reduce((sum, l) => sum + Math.max(0, l.amount || 0), 0), currency, rate)
  );
  const ownContributionVes = round2(
    convertToVes(
      earnings.filter((l) => l.isContributionBase ?? true).reduce((sum, l) => sum + Math.max(0, l.amount || 0), 0),
      currency,
      rate
    )
  );
  // AR-I is a flat %, so only what wasn't discounted yet is added.
  const islrBaseVes = round2(ownIslrVes + prior.filter((p) => !p.applyDeductions).reduce((s, p) => s + p.islrBaseVes, 0));
  // Contributions have caps, so the whole month is summed and what was already discounted subtracted.
  const contributionBaseVes = round2(ownContributionVes + prior.reduce((s, p) => s + p.contributionBaseVes, 0));
  const monthBase: MonthBaseSummary = { ownIslrVes, ownContributionVes, prior, islrBaseVes, contributionBaseVes };

  if (input.islrEnabled) {
    const parameters = resolveRateVersion(input.parameters, input.date);
    const ari = resolveRateVersion(input.ariRates, input.date);
    if (!ari) {
      errors.push("Este trabajador no tiene un % de AR-I vigente. Regístrelo en su ficha.");
    } else {
      const result = calculateAriWithholding({ taxableEarningsVes: islrBaseVes, ariPct: ari.rate_pct });
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
          description: `Retención ISLR (AR-I ${pctLabel(result.appliedPct)})`,
          amount: withheldAmount,
          withholding_key: "salary:islr",
        });
      }
    }
  }

  if (input.contributionsEnabled) {
    const parameters = resolveRateVersion(input.contributionParameters ?? [], input.date);
    if (!parameters) {
      errors.push("No hay valores de parafiscales vigentes para la fecha del pago. Revíselos en Configuración.");
    } else {
      const deducted: Partial<Record<ContributionKind, number>> = {};
      for (const p of prior) {
        for (const [kind, amount] of Object.entries(p.deductedContributionsVes) as [ContributionKind, number][]) {
          deducted[kind] = round2((deducted[kind] ?? 0) + amount);
        }
      }
      const monthDate = input.monthDate ?? input.date;
      for (const result of calculateContributions({
        monthBaseVes: contributionBaseVes,
        monthDate,
        parameters,
        previouslyDeductedVes: deducted,
      })) {
        if (result.amountVes <= 0) continue;
        const key = `contribution:${result.kind}`;
        const amount = currencyAmount(result.amountVes, currency, rate);
        contributions.push({
          key,
          kind: result.kind,
          method: result.method,
          month_base_ves: result.monthBaseVes,
          capped_base_ves: result.cappedBaseVes,
          cap_wages: result.capWages,
          minimum_wage_ves: result.minimumWageVes,
          rate_pct: result.ratePct,
          mondays: result.mondays,
          month_total_ves: result.monthTotalVes,
          previously_deducted_ves: result.previouslyDeductedVes,
          amount_ves: result.amountVes,
          amount,
          parameters_version_id: parameters.id,
        });
        items.push({
          concept_id: null,
          concept_kind: "deduction",
          description:
            `${CONTRIBUTION_LABELS[result.kind]} ${pctLabel(result.ratePct)}` +
            (result.mondays !== null ? ` (${result.mondays} lunes)` : ""),
          amount,
          contribution_key: key,
        });
      }
    }
  }

  return finish(items, [], withholdings, currency, rate, errors, {
    contributions,
    monthBasePaymentIds: prior.map((p) => p.id),
    monthBase,
  });
}

