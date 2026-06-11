import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BillingMode = "student" | "family";

/**
 * Modo de facturación del colegio: "student" (por estudiante, default)
 * o "family" (factura única por familia).
 * Los planes y saldos siguen siendo por estudiante en ambos modos.
 */
export function useBillingMode(schoolId: string | null | undefined) {
  const { data, isLoading } = useQuery({
    queryKey: ["billing-mode", schoolId],
    queryFn: async () => {
      const { data, error } = await (supabase.from("school_payment_settings" as any) as any)
        .select("billing_mode")
        .eq("school_id", schoolId!)
        .maybeSingle();
      if (error) throw error;
      return ((data as any)?.billing_mode as BillingMode) || "student";
    },
    enabled: !!schoolId,
  });

  return { billingMode: (data || "student") as BillingMode, isLoading };
}

export function useSetBillingMode(schoolId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mode: BillingMode) => {
      const { error } = await (supabase.from("school_payment_settings" as any) as any)
        .upsert(
          { school_id: schoolId!, billing_mode: mode, updated_at: new Date().toISOString() },
          { onConflict: "school_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["billing-mode", schoolId] }),
  });
}
