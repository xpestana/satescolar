import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useSchoolData() {
  const { user, userRole, context } = useAuth();
  const schoolId = context?.roleSchoolId ?? null;

  const { data: school, isLoading } = useQuery({
    queryKey: ["user-school-data", user?.id, schoolId],
    queryFn: async () => {
      const { data: school } = await supabase
        .from("schools")
        .select("id, name, logo_url")
        .eq("id", schoolId!)
        .single();

      return school;
    },
    enabled: !!user?.id && userRole === "school" && !!schoolId,
    staleTime: 5 * 60_000,
  });

  return { school, isLoading };
}
