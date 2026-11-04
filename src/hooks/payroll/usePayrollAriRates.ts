import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toPayrollError } from "@/lib/payroll/withholdings/friendlyPayrollError";
import type { AriRate } from "@/lib/payroll/withholdings/types";

const KEY = "payroll-ari-rates";

/** AR-I percentages of a school's workers. Each change is a new version, never an overwrite. */
export function usePayrollAriRates(schoolId: string | null | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: [KEY, schoolId],
    enabled: !!schoolId,
    queryFn: async (): Promise<AriRate[]> => {
      const { data, error } = await supabase
        .from("payroll_beneficiary_ari_rates")
        .select("*")
        .eq("school_id", schoolId as string)
        .order("valid_from", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AriRate[];
    },
  });

  const addAriRate = useMutation({
    mutationFn: async (input: { beneficiary_id: string; valid_from: string; rate_pct: number }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("payroll_beneficiary_ari_rates")
        .insert({ ...input, school_id: schoolId as string, created_by: userData?.user?.id ?? null });
      if (error) {
        if (error.code === "23505") throw new Error("Ya hay un % de AR-I registrado con esa fecha. Use otra fecha.");
        throw toPayrollError(error);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, schoolId] }),
  });

  const rates = query.data;
  const ratesByBeneficiary = useMemo(() => {
    const map: Record<string, AriRate[]> = {};
    for (const rate of rates ?? []) (map[rate.beneficiary_id] ??= []).push(rate);
    return map;
  }, [rates]);

  return { rates: rates ?? [], ratesByBeneficiary, isLoading: query.isLoading, addAriRate };
}
