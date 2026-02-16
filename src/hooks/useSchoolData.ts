import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useSchoolData() {
  const { user, userRole } = useAuth();

  const { data: school, isLoading } = useQuery({
    queryKey: ["user-school-data", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("school_id")
        .eq("user_id", user.id)
        .single();

      if (!roleData?.school_id) return null;

      const { data: school } = await supabase
        .from("schools")
        .select("id, name, logo_url")
        .eq("id", roleData.school_id)
        .single();

      return school;
    },
    enabled: !!user?.id && userRole === "school",
  });

  return { school, isLoading };
}
