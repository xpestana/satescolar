import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCarnetConfig(schoolId: string | null | undefined) {
  return useQuery({
    queryKey: ["carnet-config", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("carnet_config")
        .select("*")
        .eq("school_id", schoolId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!schoolId,
  });
}
