import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Per school year / momento switch that decides whether representatives may read the grades and
 * download the boleta of that momento.
 *
 * Momento 0 is the "Definitiva Final". A missing row means hidden: publication is opt-in so no
 * school starts sharing grades it had not decided to share.
 */

export const VISIBILITY_MOMENTOS = [1, 2, 3, 0] as const;

export const MOMENTO_LABELS: Record<number, string> = {
  1: "Momento 1",
  2: "Momento 2",
  3: "Momento 3",
  0: "Definitiva Final",
};

export interface GradeVisibilitySetting {
  id: string;
  school_id: string;
  school_year_id: string;
  momento: number;
  is_visible: boolean;
  updated_at: string;
}

export function useGradeVisibilitySettings(
  schoolId: string | null | undefined,
  schoolYearId: string | null | undefined,
) {
  const queryClient = useQueryClient();
  const queryKey = ["grade-visibility-settings", schoolId, schoolYearId];

  const { data: settings = [], isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<GradeVisibilitySetting[]> => {
      const { data, error } = await supabase
        .from("grade_visibility_settings")
        .select("*")
        .eq("school_id", schoolId!)
        .eq("school_year_id", schoolYearId!);
      if (error) throw error;
      return (data ?? []) as GradeVisibilitySetting[];
    },
    enabled: !!schoolId && !!schoolYearId,
  });

  const isVisible = (momento: number) =>
    settings.find((s) => s.momento === momento)?.is_visible ?? false;

  const setVisibility = useMutation({
    mutationFn: async ({ momento, visible }: { momento: number; visible: boolean }) => {
      const { error } = await supabase
        .from("grade_visibility_settings")
        .upsert(
          {
            school_id: schoolId,
            school_year_id: schoolYearId,
            momento,
            is_visible: visible,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "school_id,school_year_id,momento" },
        );
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(
        variables.visible
          ? `${MOMENTO_LABELS[variables.momento]} visible para los representantes`
          : `${MOMENTO_LABELS[variables.momento]} oculto para los representantes`,
      );
    },
    onError: () => toast.error("No se pudo guardar la configuración"),
  });

  return { settings, isVisible, setVisibility, isLoading };
}
