import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PayrollPeriod, PayrollPeriodType } from "@/lib/payroll/types";

export interface PeriodInput {
  name: string;
  period_type: PayrollPeriodType;
  start_date: string;
  end_date: string;
  status?: "open" | "closed";
  school_year_id?: string | null;
}

const KEY = "payroll-periods";

export function usePayrollPeriods(schoolId: string | null | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: [KEY, schoolId],
    enabled: !!schoolId,
    queryFn: async (): Promise<PayrollPeriod[]> => {
      const { data, error } = await supabase
        .from("payroll_periods")
        .select("*")
        .eq("school_id", schoolId as string)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PayrollPeriod[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: [KEY, schoolId] });

  const savePeriod = useMutation({
    mutationFn: async ({ id, ...input }: PeriodInput & { id?: string }) => {
      if (!schoolId) throw new Error("Colegio no resuelto");
      if (id) {
        const { error } = await supabase
          .from("payroll_periods")
          .update({ ...input, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("payroll_periods")
          .insert({ ...input, school_id: schoolId });
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });

  const deletePeriod = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payroll_periods").delete().eq("id", id);
      if (error) throw new Error(mapPeriodDeleteError(error));
    },
    onSuccess: invalidate,
  });

  return {
    periods: query.data ?? [],
    isLoading: query.isLoading,
    savePeriod,
    deletePeriod,
  };
}

function mapPeriodDeleteError(error: { code?: string; message?: string }): string {
  if (error?.code === "23503") {
    return "No se puede eliminar el período porque tiene pagos asociados.";
  }
  return error?.message ?? "Error al eliminar el período";
}
