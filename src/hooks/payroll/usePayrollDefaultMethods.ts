import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PayrollPaymentMethod } from "@/lib/payroll/types";

/**
 * Map of beneficiary_id -> preferred payment method (the default one, else the
 * first active). Used by the registration table to show each beneficiary's main
 * method without a query per row.
 */
export function usePayrollDefaultMethods(schoolId: string | null | undefined) {
  return useQuery({
    queryKey: ["payroll-default-methods", schoolId],
    enabled: !!schoolId,
    queryFn: async (): Promise<Record<string, PayrollPaymentMethod>> => {
      const { data, error } = await supabase
        .from("payroll_payment_methods")
        .select("*")
        .eq("school_id", schoolId as string)
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .order("created_at");
      if (error) throw error;
      const map: Record<string, PayrollPaymentMethod> = {};
      for (const m of (data ?? []) as unknown as PayrollPaymentMethod[]) {
        // First match per beneficiary wins (defaults come first due to ordering).
        if (!map[m.beneficiary_id]) map[m.beneficiary_id] = m;
      }
      return map;
    },
  });
}
