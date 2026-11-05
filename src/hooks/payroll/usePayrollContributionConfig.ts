import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toPayrollError } from "@/lib/payroll/withholdings/friendlyPayrollError";
import {
  DEFAULT_CONTRIBUTION_PARAMETERS,
  type ContributionParameters,
  type ContributionSettings,
} from "@/lib/payroll/contributions/types";

const KEY = "payroll-contribution-config";

export type ContributionParametersInput = Omit<ContributionParameters, "id" | "school_id" | "created_at">;

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

/** IVSS, paro forzoso and FAOV of a school. Every school starts with them off. */
export function usePayrollContributionConfig(schoolId: string | null | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: [KEY, schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const school = schoolId as string;
      const [settings, parameters] = await Promise.all([
        supabase.from("payroll_contribution_settings").select("*").eq("school_id", school).maybeSingle(),
        supabase
          .from("payroll_contribution_parameters")
          .select("*")
          .eq("school_id", school)
          .order("valid_from", { ascending: false }),
      ]);
      const failed = settings.error ?? parameters.error;
      if (failed) throw failed;
      return {
        settings: settings.data as unknown as ContributionSettings | null,
        parameters: (parameters.data ?? []) as unknown as ContributionParameters[],
      };
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: [KEY, schoolId] });

  /** Creates the settings (off) and the starting values, if missing. */
  const ensureDefaults = useMutation({
    mutationFn: async () => {
      const school = schoolId as string;
      const userId = await currentUserId();
      const settings = await supabase
        .from("payroll_contribution_settings")
        .upsert({ school_id: school }, { onConflict: "school_id", ignoreDuplicates: true });
      if (settings.error) throw toPayrollError(settings.error);
      if ((query.data?.parameters.length ?? 0) === 0) {
        const { error } = await supabase
          .from("payroll_contribution_parameters")
          .insert({ ...DEFAULT_CONTRIBUTION_PARAMETERS, school_id: school, created_by: userId });
        if (error) throw toPayrollError(error);
      }
    },
    onSuccess: invalidate,
  });

  const setEnabled = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from("payroll_contribution_settings")
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq("school_id", schoolId as string);
      if (error) throw toPayrollError(error);
    },
    onSuccess: invalidate,
  });

  const markValidated = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("payroll_contribution_settings")
        .update({
          rates_validated_at: new Date().toISOString(),
          rates_validated_by: await currentUserId(),
          updated_at: new Date().toISOString(),
        })
        .eq("school_id", schoolId as string);
      if (error) throw toPayrollError(error);
    },
    onSuccess: invalidate,
  });

  const addParameters = useMutation({
    mutationFn: async (input: ContributionParametersInput) => {
      const { error } = await supabase
        .from("payroll_contribution_parameters")
        .insert({ ...input, school_id: schoolId as string, created_by: await currentUserId() });
      if (error) throw toPayrollError(error);
    },
    onSuccess: invalidate,
  });

  const deleteFutureParameters = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payroll_contribution_parameters").delete().eq("id", id);
      if (error) throw toPayrollError(error);
    },
    onSuccess: invalidate,
  });

  return {
    settings: query.data?.settings ?? null,
    parameters: query.data?.parameters ?? [],
    enabled: !!query.data?.settings?.enabled,
    isLoading: query.isLoading,
    ensureDefaults,
    setEnabled,
    markValidated,
    addParameters,
    deleteFutureParameters,
  };
}
