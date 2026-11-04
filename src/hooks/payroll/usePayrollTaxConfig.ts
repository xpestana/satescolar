import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toPayrollError } from "@/lib/payroll/withholdings/friendlyPayrollError";
import type {
  AmountMode,
  IslrConcept,
  IslrRateVersion,
  PersonType,
  TaxParameters,
  TaxSettings,
} from "@/lib/payroll/withholdings/types";

const KEY = "payroll-tax-config";

export interface TaxParametersInput {
  valid_from: string;
  vat_standard_pct: number;
  vat_full_pct: number;
  default_vat_rate_pct: number;
  tax_unit_value: number;
  petty_cash_ut_limit: number;
}

export interface IslrRateInput {
  concept_id: string;
  person_type: PersonType;
  valid_from: string;
  base_pct: number;
  rate_pct: number;
  subtrahend_mode: AmountMode;
  subtrahend_amount: number;
  minimum_mode: AmountMode;
  minimum_amount: number;
}

export interface TaxConfig {
  settings: TaxSettings | null;
  parameters: TaxParameters[];
  concepts: IslrConcept[];
  rates: IslrRateVersion[];
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

/** Withholding settings of a school. Every school starts with both taxes off. */
export function usePayrollTaxConfig(schoolId: string | null | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: [KEY, schoolId],
    enabled: !!schoolId,
    queryFn: async (): Promise<TaxConfig> => {
      const school = schoolId as string;
      const [settings, parameters, concepts, rates] = await Promise.all([
        supabase.from("payroll_tax_settings").select("*").eq("school_id", school).maybeSingle(),
        supabase.from("payroll_tax_parameters").select("*").eq("school_id", school).order("valid_from", { ascending: false }),
        supabase.from("payroll_islr_concepts").select("*").eq("school_id", school).order("display_order").order("name"),
        supabase.from("payroll_islr_rate_versions").select("*").eq("school_id", school).order("valid_from", { ascending: false }),
      ]);
      const failed = settings.error ?? parameters.error ?? concepts.error ?? rates.error;
      if (failed) throw failed;
      return {
        settings: settings.data as unknown as TaxSettings | null,
        parameters: (parameters.data ?? []) as unknown as TaxParameters[],
        concepts: (concepts.data ?? []) as unknown as IslrConcept[],
        rates: (rates.data ?? []) as unknown as IslrRateVersion[],
      };
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: [KEY, schoolId] });

  const ensureDefaults = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("ensure_payroll_tax_defaults", { _school_id: schoolId as string });
      if (error) throw toPayrollError(error);
    },
    onSuccess: invalidate,
  });

  const updateSettings = useMutation({
    mutationFn: async (patch: Partial<Omit<TaxSettings, "school_id">>) => {
      const { error } = await supabase
        .from("payroll_tax_settings")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("school_id", schoolId as string);
      if (error) throw toPayrollError(error);
    },
    onSuccess: invalidate,
  });

  const markRatesValidated = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("payroll_tax_settings")
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
    mutationFn: async (input: TaxParametersInput) => {
      const { error } = await supabase
        .from("payroll_tax_parameters")
        .insert({ ...input, school_id: schoolId as string, created_by: await currentUserId() });
      if (error) throw toPayrollError(error);
    },
    onSuccess: invalidate,
  });

  const deleteFutureParameters = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payroll_tax_parameters").delete().eq("id", id);
      if (error) throw toPayrollError(error);
    },
    onSuccess: invalidate,
  });

  const addRate = useMutation({
    mutationFn: async (input: IslrRateInput) => {
      const { error } = await supabase
        .from("payroll_islr_rate_versions")
        .insert({ ...input, school_id: schoolId as string, created_by: await currentUserId() });
      if (error) throw toPayrollError(error);
    },
    onSuccess: invalidate,
  });

  const deleteFutureRate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payroll_islr_rate_versions").delete().eq("id", id);
      if (error) throw toPayrollError(error);
    },
    onSuccess: invalidate,
  });

  const saveConcept = useMutation({
    mutationFn: async ({ id, ...input }: { id?: string; name: string; seniat_code: string | null; is_active?: boolean }) => {
      const { error } = id
        ? await supabase
            .from("payroll_islr_concepts")
            .update({ ...input, updated_at: new Date().toISOString() })
            .eq("id", id)
        : await supabase.from("payroll_islr_concepts").insert({
            ...input,
            school_id: schoolId as string,
            display_order: (query.data?.concepts.length ?? 0) + 1,
          });
      if (error) throw toPayrollError(error);
    },
    onSuccess: invalidate,
  });

  const data = query.data;
  return {
    settings: data?.settings ?? null,
    parameters: data?.parameters ?? [],
    concepts: data?.concepts ?? [],
    rates: data?.rates ?? [],
    vatEnabled: !!data?.settings?.vat_agent_enabled,
    islrEnabled: !!data?.settings?.islr_agent_enabled,
    isLoading: query.isLoading,
    ensureDefaults,
    updateSettings,
    markRatesValidated,
    addParameters,
    deleteFutureParameters,
    addRate,
    deleteFutureRate,
    saveConcept,
  };
}
