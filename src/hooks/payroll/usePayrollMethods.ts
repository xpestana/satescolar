import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PayrollMethodType, PayrollPaymentMethod } from "@/lib/payroll/types";

export interface MethodInput {
  method_type: PayrollMethodType;
  label?: string | null;
  config?: Record<string, unknown>;
  is_default?: boolean;
  is_active?: boolean;
}

const KEY = "payroll-methods";

export function usePayrollMethods(
  schoolId: string | null | undefined,
  beneficiaryId: string | null | undefined
) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: [KEY, beneficiaryId],
    enabled: !!beneficiaryId,
    queryFn: async (): Promise<PayrollPaymentMethod[]> => {
      const { data, error } = await supabase
        .from("payroll_payment_methods")
        .select("*")
        .eq("beneficiary_id", beneficiaryId as string)
        .order("is_default", { ascending: false })
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as PayrollPaymentMethod[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: [KEY, beneficiaryId] });

  const saveMethod = useMutation({
    mutationFn: async ({ id, ...input }: MethodInput & { id?: string }) => {
      if (!schoolId || !beneficiaryId) throw new Error("Beneficiario no resuelto");
      // Only one default per beneficiary.
      if (input.is_default) {
        await supabase
          .from("payroll_payment_methods")
          .update({ is_default: false })
          .eq("beneficiary_id", beneficiaryId);
      }
      const payload = { ...input, config: (input.config ?? {}) as never };
      if (id) {
        const { error } = await supabase
          .from("payroll_payment_methods")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("payroll_payment_methods")
          .insert({ ...payload, beneficiary_id: beneficiaryId, school_id: schoolId });
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });

  const deleteMethod = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payroll_payment_methods").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    methods: query.data ?? [],
    isLoading: query.isLoading,
    saveMethod,
    deleteMethod,
  };
}
