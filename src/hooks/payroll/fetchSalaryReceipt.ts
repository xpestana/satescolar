import { supabase } from "@/integrations/supabase/client";
import { buildSalaryReceipt, type ContributionKindLabel, type SalaryReceiptData } from "@/lib/payroll/salaryReceipt";
import type { PayrollCategory, PayrollCurrency, PayrollMethodType } from "@/lib/payroll/types";

/** Everything the salary receipt prints, read for one payment. Null for supplier payments. */
export async function fetchSalaryReceipt(paymentId: string): Promise<SalaryReceiptData | null> {
  const { data: payment, error } = await supabase
    .from("payroll_payments")
    .select(
      "id, school_id, payment_kind, currency, exchange_rate, notes, " +
        "payroll_beneficiaries(full_name, document_id, tax_id, category, hire_date, job_title), " +
        "payroll_periods(name, start_date, end_date, period_type), " +
        "payroll_payment_methods(method_type, config)"
    )
    .eq("id", paymentId)
    .single();
  if (error) throw error;
  const p = payment as unknown as {
    school_id: string;
    payment_kind: string;
    currency: PayrollCurrency;
    exchange_rate: number;
    notes: string | null;
    payroll_beneficiaries: { full_name: string; document_id: string | null; tax_id: string | null; category: PayrollCategory; hire_date: string | null; job_title: string | null } | null;
    payroll_periods: { name: string; start_date: string; end_date: string; period_type: "monthly" | "biweekly" } | null;
    payroll_payment_methods: { method_type: PayrollMethodType; config: Record<string, unknown> | null } | null;
  };
  if (p.payment_kind !== "payroll") return null;

  const [items, contributions, withholdings, school, contributionSettings, taxSettings] = await Promise.all([
    supabase
      .from("payroll_payment_items")
      .select("concept_kind, description, amount, amount_ves, receipt_text, unpaid_hours, contribution_id, withholding_id, payroll_concepts(receipt_text, is_base_salary)")
      .eq("payment_id", paymentId)
      .order("created_at"),
    supabase.from("payroll_contributions").select("id, kind").eq("payment_id", paymentId),
    supabase.from("payroll_withholdings").select("id, rate_pct").eq("payment_id", paymentId),
    supabase.from("schools").select("name, address, rif, phone").eq("id", p.school_id).single(),
    supabase.from("payroll_contribution_settings").select("enabled").eq("school_id", p.school_id).maybeSingle(),
    supabase.from("payroll_tax_settings").select("islr_agent_enabled").eq("school_id", p.school_id).maybeSingle(),
  ]);
  const failed = items.error ?? contributions.error ?? withholdings.error ?? school.error;
  if (failed) throw failed;

  const kindById = new Map((contributions.data ?? []).map((c) => [c.id, c.kind as ContributionKindLabel]));
  const pctById = new Map((withholdings.data ?? []).map((w) => [w.id, Number(w.rate_pct)]));
  const b = p.payroll_beneficiaries;
  const period = p.payroll_periods;

  return buildSalaryReceipt({
    school: school.data ?? { name: "", address: null, rif: null, phone: null },
    beneficiary: {
      name: b?.full_name ?? "",
      documentId: b?.document_id ?? b?.tax_id ?? null,
      category: b?.category ?? "other",
      hireDate: b?.hire_date ?? null,
      jobTitle: b?.job_title ?? null,
    },
    period: {
      name: period?.name ?? "",
      start: period?.start_date ?? "",
      end: period?.end_date ?? "",
      type: period?.period_type ?? "monthly",
    },
    method: p.payroll_payment_methods ? { type: p.payroll_payment_methods.method_type, config: p.payroll_payment_methods.config } : null,
    currency: p.currency,
    exchangeRate: Number(p.exchange_rate) || 0,
    lines: (items.data ?? []).map((i) => {
      const concept = i.payroll_concepts as { receipt_text: string | null; is_base_salary: boolean } | null;
      return {
        concept_kind: i.concept_kind as "earning" | "deduction",
        description: i.description,
        amount: Number(i.amount) || 0,
        amount_ves: i.amount_ves,
        receipt_text: i.receipt_text,
        concept_receipt_text: concept?.receipt_text ?? null,
        is_base_salary: concept?.is_base_salary ?? false,
        contribution_kind: i.contribution_id ? kindById.get(i.contribution_id) ?? null : null,
        islr_pct: i.withholding_id ? pctById.get(i.withholding_id) ?? null : null,
        unpaid_hours: i.unpaid_hours,
      };
    }),
    notes: p.notes,
    contributionsEnabled: !!contributionSettings.data?.enabled,
    islrEnabled: !!taxSettings.data?.islr_agent_enabled,
  });
}
