import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toPayrollError } from "@/lib/payroll/withholdings/friendlyPayrollError";
import type { BeneficiaryPayload } from "@/lib/payroll/withholdings/beneficiaryFormSchema";
import type { PayrollBeneficiary } from "@/lib/payroll/types";

export type BeneficiaryInput = BeneficiaryPayload & { is_active?: boolean };

const KEY = "payroll-beneficiaries";

export function usePayrollBeneficiaries(schoolId: string | null | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: [KEY, schoolId],
    enabled: !!schoolId,
    queryFn: async (): Promise<PayrollBeneficiary[]> => {
      const { data, error } = await supabase
        .from("payroll_beneficiaries")
        .select("*")
        .eq("school_id", schoolId as string)
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as unknown as PayrollBeneficiary[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: [KEY, schoolId] });

  const createBeneficiary = useMutation({
    mutationFn: async (input: BeneficiaryInput): Promise<string> => {
      if (!schoolId) throw new Error("Colegio no resuelto");
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("payroll_beneficiaries")
        .insert({ ...input, school_id: schoolId, created_by: userData?.user?.id ?? null })
        .select("id")
        .single();
      if (error) throw toPayrollError(error);
      return data.id;
    },
    onSuccess: invalidate,
  });

  const updateBeneficiary = useMutation({
    mutationFn: async ({ id, ...input }: BeneficiaryInput & { id: string }) => {
      const { error } = await supabase
        .from("payroll_beneficiaries")
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw toPayrollError(error);
    },
    onSuccess: invalidate,
  });

  const deleteBeneficiary = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payroll_beneficiaries").delete().eq("id", id);
      if (error) throw toPayrollError(error);
    },
    onSuccess: invalidate,
  });

  return {
    beneficiaries: query.data ?? [],
    isLoading: query.isLoading,
    createBeneficiary,
    updateBeneficiary,
    deleteBeneficiary,
  };
}
