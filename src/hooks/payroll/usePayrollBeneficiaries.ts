import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PayrollBeneficiary, PayrollCategory } from "@/lib/payroll/types";

export interface BeneficiaryInput {
  category: PayrollCategory;
  teacher_id?: string | null;
  full_name: string;
  document_id?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  is_active?: boolean;
}

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
    mutationFn: async (input: BeneficiaryInput) => {
      if (!schoolId) throw new Error("Colegio no resuelto");
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("payroll_beneficiaries").insert({
        ...input,
        document_id: input.document_id?.trim() || null,
        school_id: schoolId,
        created_by: userData?.user?.id ?? null,
      });
      if (error) throw mapDuplicateError(error);
    },
    onSuccess: invalidate,
  });

  const updateBeneficiary = useMutation({
    mutationFn: async ({ id, ...input }: BeneficiaryInput & { id: string }) => {
      const { error } = await supabase
        .from("payroll_beneficiaries")
        .update({
          ...input,
          document_id: input.document_id?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw mapDuplicateError(error);
    },
    onSuccess: invalidate,
  });

  const deleteBeneficiary = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payroll_beneficiaries").delete().eq("id", id);
      if (error) throw error;
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

/** Turn the Postgres unique-violation into a user-friendly Spanish message. */
function mapDuplicateError(error: { code?: string; message?: string }): Error {
  if (error?.code === "23505") {
    return new Error("Ya existe un beneficiario con esa cédula en este colegio.");
  }
  return new Error(error?.message ?? "Error al guardar el beneficiario");
}
