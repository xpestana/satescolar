import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PayrollLineItem } from "@/lib/payroll/types";

/** Line items (earnings/deductions) for a single payroll payment. */
export function usePayrollPaymentItems(paymentId: string | null | undefined) {
  return useQuery({
    queryKey: ["payroll-payment-items", paymentId],
    enabled: !!paymentId,
    queryFn: async (): Promise<PayrollLineItem[]> => {
      const { data, error } = await supabase
        .from("payroll_payment_items")
        .select("concept_id, concept_kind, description, amount")
        .eq("payment_id", paymentId as string)
        .order("concept_kind");
      if (error) throw error;
      return (data ?? []) as unknown as PayrollLineItem[];
    },
  });
}
