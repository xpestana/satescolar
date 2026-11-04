import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { todayCaracasIso } from "@/lib/dateUtils";
import { buildSalaryPaymentDraft, buildSupplierPaymentDraft } from "@/lib/payroll/withholdings/buildPaymentDraft";
import { toPayrollError } from "@/lib/payroll/withholdings/friendlyPayrollError";
import type { ConceptKind, PayrollBeneficiary, PayrollConcept } from "@/lib/payroll/types";
import type { PayrollPaymentRow } from "@/hooks/payroll/usePayrollPayments";
import { usePayrollAriRates } from "@/hooks/payroll/usePayrollAriRates";
import { usePayrollConcepts } from "@/hooks/payroll/usePayrollConcepts";
import { usePayrollTaxConfig } from "@/hooks/payroll/usePayrollTaxConfig";

/**
 * Re-applies the rates in force today to an unpaid payment. The payment goes back to draft,
 * because its net may change and it was approved with another amount.
 */
export function usePayrollRecalculate(schoolId: string | null | undefined) {
  const qc = useQueryClient();
  const { vatEnabled, islrEnabled, parameters, concepts: islrConcepts, rates } = usePayrollTaxConfig(schoolId);
  const { ratesByBeneficiary } = usePayrollAriRates(schoolId);
  const { concepts } = usePayrollConcepts(schoolId);

  return useMutation({
    mutationFn: async (payment: PayrollPaymentRow) => {
      const [beneficiaryResult, itemsResult, documentsResult, overridesResult] = await Promise.all([
        supabase.from("payroll_beneficiaries").select("*").eq("id", payment.beneficiary_id).single(),
        supabase.from("payroll_payment_items").select("*").eq("payment_id", payment.id),
        supabase.from("payroll_purchase_documents").select("*").eq("payment_id", payment.id),
        supabase
          .from("payroll_withholdings")
          .select("document_id, tax_type, rate_pct, override_reason")
          .eq("payment_id", payment.id)
          .eq("is_override", true),
      ]);
      const failed = beneficiaryResult.error ?? itemsResult.error ?? documentsResult.error ?? overridesResult.error;
      if (failed) throw toPayrollError(failed);

      // One-off percentages were decided by hand, so they survive a recalculation.
      const overrideOf = (documentId: string, taxType: "vat" | "islr") => {
        const row = (overridesResult.data ?? []).find((o) => o.document_id === documentId && o.tax_type === taxType);
        return row ? { pct: row.rate_pct, reason: row.override_reason ?? "" } : null;
      };

      const beneficiary = beneficiaryResult.data as unknown as PayrollBeneficiary;
      const context = { vatEnabled, islrEnabled, date: todayCaracasIso(), parameters };

      const draft =
        payment.payment_kind === "invoice"
          ? buildSupplierPaymentDraft({
              ...context,
              currency: payment.currency,
              exchangeRate: payment.exchange_rate,
              personType: beneficiary.person_type,
              vatMode: beneficiary.vat_withholding_mode,
              vatExclusionReason: beneficiary.vat_exclusion_reason,
              concepts: islrConcepts,
              rates,
              documents: (documentsResult.data ?? []).map((d) => ({
                key: d.id,
                document_type: d.document_type as "invoice" | "debit_note",
                document_number: d.document_number,
                control_number: d.control_number,
                issue_date: d.issue_date,
                taxable_base: d.taxable_base,
                exempt_amount: d.exempt_amount,
                vat_rate_pct: d.vat_rate_pct,
                vat_amount: d.vat_amount,
                total_amount: d.total_amount,
                islr_concept_id: d.islr_concept_id,
                is_petty_cash: d.is_petty_cash,
                is_vat_not_itemized: d.is_vat_not_itemized,
                is_non_compliant: d.is_non_compliant,
                vatOverride: overrideOf(d.id, "vat"),
                islrOverride: overrideOf(d.id, "islr"),
              })),
            })
          : buildSalaryPaymentDraft({
              ...context,
              currency: payment.currency,
              exchangeRate: payment.exchange_rate,
              ariRates: ratesByBeneficiary[payment.beneficiary_id] ?? [],
              lines: (itemsResult.data ?? [])
                .filter((i) => !i.withholding_id)
                .map((i) => ({
                  concept_id: i.concept_id,
                  concept_kind: i.concept_kind as ConceptKind,
                  description: i.description,
                  amount: i.amount,
                  isTaxable: isLineTaxable(i.concept_id, concepts),
                })),
            });

      if (draft.errors.length > 0) throw new Error(draft.errors[0]);

      const { error } = await supabase.rpc("recalculate_payroll_payment_withholdings", {
        _payment_id: payment.id,
        _payload: { items: draft.items, withholdings: draft.withholdings } as unknown as Json,
      });
      if (error) throw toPayrollError(error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll-payments", schoolId] });
      qc.invalidateQueries({ queryKey: ["payroll-withholdings", schoolId] });
    },
  });
}

function isLineTaxable(conceptId: string | null, concepts: PayrollConcept[]): boolean {
  if (!conceptId) return true;
  return concepts.find((c) => c.id === conceptId)?.is_islr_taxable ?? true;
}
