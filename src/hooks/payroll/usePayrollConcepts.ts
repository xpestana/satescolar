import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ConceptKind, PayrollConcept, PayrollCurrency } from "@/lib/payroll/types";

export interface ConceptInput {
  name: string;
  concept_kind: ConceptKind;
  default_amount: number;
  currency: PayrollCurrency;
  is_active?: boolean;
}

const KEY = "payroll-concepts";

export function usePayrollConcepts(schoolId: string | null | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: [KEY, schoolId],
    enabled: !!schoolId,
    queryFn: async (): Promise<PayrollConcept[]> => {
      const { data, error } = await supabase
        .from("payroll_concepts")
        .select("*")
        .eq("school_id", schoolId as string)
        .order("concept_kind")
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as PayrollConcept[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: [KEY, schoolId] });

  const saveConcept = useMutation({
    mutationFn: async ({ id, ...input }: ConceptInput & { id?: string }) => {
      if (!schoolId) throw new Error("Colegio no resuelto");
      if (id) {
        const { error } = await supabase
          .from("payroll_concepts")
          .update({ ...input, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("payroll_concepts")
          .insert({ ...input, school_id: schoolId });
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });

  const deleteConcept = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payroll_concepts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    concepts: query.data ?? [],
    isLoading: query.isLoading,
    saveConcept,
    deleteConcept,
  };
}
