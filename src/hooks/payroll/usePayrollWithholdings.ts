import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { WithholdingRow } from "@/lib/payroll/withholdings/buildWithholdingVoucherData";
import { toPayrollError } from "@/lib/payroll/withholdings/friendlyPayrollError";
import type { TaxType } from "@/lib/payroll/withholdings/types";

const KEY = "payroll-withholdings";
const DOCUMENT_FIELDS =
  "payroll_purchase_documents(document_type, document_number, control_number, issue_date, total_amount, taxable_base, exempt_amount, vat_rate_pct, vat_amount)";

interface WithholdingFilters {
  taxType: TaxType;
  periodStart?: string;
}

/** Issued withholdings of a fiscal period. Drafts appear here only once they're paid. */
export function usePayrollWithholdings(schoolId: string | null | undefined, filters: WithholdingFilters) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: [KEY, schoolId, filters.taxType, filters.periodStart ?? "none"],
    enabled: !!schoolId && !!filters.periodStart,
    queryFn: async (): Promise<WithholdingRow[]> => {
      const { data, error } = await supabase
        .from("payroll_withholdings")
        .select(`*, ${DOCUMENT_FIELDS}`)
        .eq("school_id", schoolId as string)
        .eq("tax_type", filters.taxType)
        .eq("fiscal_period_start", filters.periodStart as string)
        .neq("status", "calculated")
        .order("voucher_number", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as WithholdingRow[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: [KEY, schoolId] });

  const setStatus = useMutation({
    mutationFn: async (input: { ids: string[]; status: "declared" | "remitted"; date: string; reference: string }) => {
      const { data, error } = await supabase.rpc("set_payroll_withholdings_status", {
        _school_id: schoolId as string,
        _withholding_ids: input.ids,
        _status: input.status,
        _date: input.date,
        _reference: input.reference,
      });
      if (error) throw toPayrollError(error);
      return data as number;
    },
    onSuccess: invalidate,
  });

  const sendVoucher = useMutation({
    mutationFn: async (withholdingId: string) => {
      const { data, error } = await supabase.functions.invoke("send-withholding-voucher", {
        body: { withholding_id: withholdingId },
      });
      if (error) throw new Error("No se pudo enviar el comprobante");
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: invalidate,
  });

  return { rows: query.data ?? [], isLoading: query.isLoading, setStatus, sendVoucher };
}

/** Salary withholdings of a year, for the yearly certificates (ARC). */
export function usePayrollSalaryWithholdings(schoolId: string | null | undefined, year: number, enabled: boolean) {
  return useQuery({
    queryKey: [KEY, schoolId, "salary", year],
    enabled: !!schoolId && enabled,
    queryFn: async (): Promise<WithholdingRow[]> => {
      const { data, error } = await supabase
        .from("payroll_withholdings")
        .select(`*, ${DOCUMENT_FIELDS}`)
        .eq("school_id", schoolId as string)
        .eq("source", "salary")
        .neq("status", "calculated")
        .gte("fiscal_period_start", `${year}-01-01`)
        .lte("fiscal_period_start", `${year}-12-31`);
      if (error) throw error;
      return (data ?? []) as unknown as WithholdingRow[];
    },
  });
}
