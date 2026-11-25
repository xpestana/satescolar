import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SchoolSection {
  id: string;
  name: string;
  grade_level: string;
  is_technical: boolean;
}

/** Sections of a school ordered by grade and letter. Shared by Notas and the Centro de Consultas. */
export function useSchoolSections(schoolId: string | null | undefined) {
  return useQuery({
    queryKey: ["school-sections-list", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sections")
        .select("id, name, grade_level, is_technical")
        .eq("school_id", schoolId!)
        .order("grade_level")
        .order("name");
      if (error) throw error;
      return (data || []) as SchoolSection[];
    },
    enabled: !!schoolId,
  });
}
