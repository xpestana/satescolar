import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Current USD -> VES rate for the school (from the shared exchange_rates table,
 * the same source the payments module edits via ExchangeRateWidget).
 */
export function usePayrollUsdRate(schoolId: string | null | undefined) {
  return useQuery({
    queryKey: ["payroll-usd-rate", schoolId],
    enabled: !!schoolId,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase
        .from("exchange_rates")
        .select("rate_to_ves")
        .eq("school_id", schoolId as string)
        .eq("currency", "USD")
        .maybeSingle();
      if (error) throw error;
      return data?.rate_to_ves ?? 0;
    },
  });
}
