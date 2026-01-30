import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useSchoolId() {
  const { user } = useAuth();

  const { data: schoolId, isLoading } = useQuery({
    queryKey: ["user-school-id", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("user_roles")
        .select("school_id")
        .eq("user_id", user.id)
        .single();
      
      if (error) throw error;
      return data?.school_id ?? null;
    },
    enabled: !!user?.id,
  });

  return { schoolId, isLoading };
}
