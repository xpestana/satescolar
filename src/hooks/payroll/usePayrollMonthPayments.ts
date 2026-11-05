import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toPayrollError } from "@/lib/payroll/withholdings/friendlyPayrollError";
import type { MonthPaymentRow } from "@/lib/payroll/contributions/monthBase";

function monthEnd(date: string): string {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${date.slice(0, 7)}-${String(last).padStart(2, "0")}`;
}

/** Live salary payments of a worker in the month of `periodEndDate`, except `excludePaymentId`. */
export async function fetchMonthPayments(
  beneficiaryId: string,
  periodEndDate: string,
  excludePaymentId?: string
): Promise<MonthPaymentRow[]> {
  const { data, error } = await supabase
    .from("payroll_payments")
    .select(
      "id, status, currency, exchange_rate, " +
        "payroll_periods!inner(id, name, end_date, apply_deductions), " +
        "payroll_payment_items(concept_id, concept_kind, amount, withholding_id, contribution_id), " +
        "payroll_contributions!payroll_contributions_payment_id_fkey(kind, amount_ves)"
    )
    .eq("beneficiary_id", beneficiaryId)
    .eq("payment_kind", "payroll")
    .neq("status", "voided")
    .gte("payroll_periods.end_date", `${periodEndDate.slice(0, 7)}-01`)
    .lte("payroll_periods.end_date", monthEnd(periodEndDate));
  if (error) throw toPayrollError(error);

  type Raw = Omit<MonthPaymentRow, "period" | "items" | "contributions"> & {
    payroll_periods: MonthPaymentRow["period"];
    payroll_payment_items: MonthPaymentRow["items"] | null;
    payroll_contributions: MonthPaymentRow["contributions"] | null;
  };
  return ((data ?? []) as unknown as Raw[])
    .filter((row) => row.id !== excludePaymentId)
    .map((row) => ({
      id: row.id,
      status: row.status,
      currency: row.currency,
      exchange_rate: Number(row.exchange_rate) || 0,
      period: row.payroll_periods,
      items: row.payroll_payment_items ?? [],
      contributions: row.payroll_contributions ?? [],
    }));
}

export function usePayrollMonthPayments(
  beneficiaryId: string | null | undefined,
  periodEndDate: string | null | undefined,
  enabled = true
) {
  return useQuery({
    queryKey: ["payroll-month-payments", beneficiaryId, periodEndDate],
    enabled: enabled && !!beneficiaryId && !!periodEndDate,
    queryFn: () => fetchMonthPayments(beneficiaryId as string, periodEndDate as string),
  });
}
