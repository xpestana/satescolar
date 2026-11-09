import { supabase } from "@/integrations/supabase/client";
import { toPayrollError } from "@/lib/payroll/withholdings/friendlyPayrollError";
import type { SheetPaymentInput } from "@/lib/payroll/payrollSheet";
import type { ContributionKind } from "@/lib/payroll/contributions/types";

/** Salary payments of a period, with what the payroll sheet needs from each line. */
export async function fetchPayrollSheetPayments(schoolId: string, periodId: string): Promise<SheetPaymentInput[]> {
  const { data, error } = await supabase
    .from("payroll_payments")
    .select(
      "status, currency, exchange_rate, payment_reference, " +
        "payroll_beneficiaries(full_name, document_id, hire_date, job_title, category), " +
        "payroll_payment_items(concept_kind, description, amount, amount_ves, withholding_id, unpaid_hours, " +
        "payroll_concepts(name, is_base_salary), " +
        "payroll_contributions!payroll_payment_items_contribution_fk(kind))"
    )
    .eq("school_id", schoolId)
    .eq("period_id", periodId)
    .eq("payment_kind", "payroll")
    .neq("status", "voided");
  if (error) throw toPayrollError(error);

  type Raw = Omit<SheetPaymentInput, "beneficiary" | "items"> & {
    payroll_beneficiaries: SheetPaymentInput["beneficiary"];
    payroll_payment_items: (Omit<SheetPaymentInput["items"][number], "contribution_kind" | "concept"> & {
      payroll_contributions: { kind: ContributionKind } | null;
      payroll_concepts: { name: string; is_base_salary: boolean } | null;
    })[];
  };
  return ((data ?? []) as unknown as Raw[]).map((p) => ({
    status: p.status,
    currency: p.currency,
    exchange_rate: Number(p.exchange_rate) || 0,
    payment_reference: p.payment_reference,
    beneficiary: p.payroll_beneficiaries,
    items: (p.payroll_payment_items ?? []).map(({ payroll_contributions, payroll_concepts, ...item }) => ({
      ...item,
      contribution_kind: payroll_contributions?.kind ?? null,
      concept: payroll_concepts,
    })),
  }));
}
