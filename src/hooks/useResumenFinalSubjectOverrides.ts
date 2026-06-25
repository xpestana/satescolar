import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SubjectOverride = {
  subject_id: string;
  custom_name: string | null;
  custom_abbreviation: string | null;
};

export function useResumenFinalSubjectOverrides(
  schoolId: string | null,
  schoolYearId: string,
  planillaType: "31059" | "31060",
) {
  const queryClient = useQueryClient();
  const queryKey = ["resumen-final-subject-overrides", schoolId, schoolYearId, planillaType];

  const { data: overrides = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resumen_final_subject_overrides")
        .select("subject_id, custom_name, custom_abbreviation")
        .eq("school_id", schoolId!)
        .eq("school_year_id", schoolYearId)
        .eq("planilla_type", planillaType);
      if (error) throw error;
      return (data ?? []) as SubjectOverride[];
    },
    enabled: !!schoolId && !!schoolYearId,
  });

  const overridesMap = new Map(overrides.map((o) => [o.subject_id, o]));

  const saveOverrides = useMutation({
    mutationFn: async (
      rows: Array<{
        subject_id: string;
        custom_name: string | null;
        custom_abbreviation: string | null;
      }>,
    ) => {
      const payload = rows.map((r) => ({
        school_id: schoolId!,
        school_year_id: schoolYearId,
        planilla_type: planillaType,
        subject_id: r.subject_id,
        custom_name: r.custom_name || null,
        custom_abbreviation: r.custom_abbreviation || null,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase
        .from("resumen_final_subject_overrides")
        .upsert(payload, { onConflict: "school_id,school_year_id,planilla_type,subject_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return { overrides, overridesMap, isLoading, saveOverrides };
}
