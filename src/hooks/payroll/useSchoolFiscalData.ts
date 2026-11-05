import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** The school's name, RIF and address: what its withholding vouchers show as the agent. */
export function useSchoolFiscalData(schoolId: string | null | undefined) {
  return useQuery({
    queryKey: ["school-fiscal-data", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schools")
        .select("name, rif, address")
        .eq("id", schoolId as string)
        .single();
      if (error) throw error;
      return data;
    },
  });
}
