import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlanillasConfig } from "@/hooks/usePlanillasConfig";
import { buildOwnSchoolInstitution, findStateAcronym } from "@/lib/grade-certificate";

/**
 * The issuing school as an institution of the certificate, built from Planillas → Datos comunes
 * (name, municipality and the acronym of its state).
 */
export function useOwnSchoolInstitution() {
  const { schoolHeader, isLoading } = usePlanillasConfig();

  const { data: states = [] } = useQuery({
    queryKey: ["states-acronyms"],
    queryFn: async () => {
      const { data, error } = await supabase.from("states").select("name, acronym");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: Infinity,
  });

  const ownSchool = useMemo(
    () => buildOwnSchoolInstitution(schoolHeader, findStateAcronym(states, schoolHeader.entidad_federal)),
    [schoolHeader, states],
  );

  return { ownSchool, isLoading };
}
