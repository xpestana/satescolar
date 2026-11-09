import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toPayrollError } from "@/lib/payroll/withholdings/friendlyPayrollError";
import type { BeneficiaryConcept } from "@/lib/payroll/defaultConcepts";

const KEY = "payroll-beneficiary-concepts";

/** A worker's own concepts: their amounts, the defaults they don't get and concepts only they get. */
export function usePayrollBeneficiaryConcepts(schoolId: string | null | undefined, beneficiaryId: string | null | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: [KEY, beneficiaryId],
    enabled: !!schoolId && !!beneficiaryId,
    queryFn: async (): Promise<BeneficiaryConcept[]> => {
      const { data, error } = await supabase
        .from("payroll_beneficiary_concepts")
        .select("concept_id, enabled, amount")
        .eq("beneficiary_id", beneficiaryId as string);
      if (error) throw toPayrollError(error);
      return (data ?? []).map((r) => ({ concept_id: r.concept_id, enabled: r.enabled, amount: r.amount === null ? null : Number(r.amount) }));
    },
  });

  /** Saves the worker's settings: rows given are kept, every other concept goes back to the default. */
  const save = useMutation({
    mutationFn: async (rows: BeneficiaryConcept[]) => {
      const beneficiary = beneficiaryId as string;
      const keep = rows.map((r) => r.concept_id);
      let remove = supabase.from("payroll_beneficiary_concepts").delete().eq("beneficiary_id", beneficiary);
      if (keep.length > 0) remove = remove.not("concept_id", "in", `(${keep.join(",")})`);
      const removed = await remove;
      if (removed.error) throw toPayrollError(removed.error);
      if (rows.length === 0) return;
      const { error } = await supabase.from("payroll_beneficiary_concepts").upsert(
        rows.map((r) => ({
          school_id: schoolId as string,
          beneficiary_id: beneficiary,
          concept_id: r.concept_id,
          enabled: r.enabled,
          amount: r.amount,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "beneficiary_id,concept_id" }
      );
      if (error) throw toPayrollError(error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, beneficiaryId] }),
  });

  return { own: query.data ?? [], isLoading: query.isLoading, isFetched: query.isFetched, save };
}
