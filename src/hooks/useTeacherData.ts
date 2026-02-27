import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useTeacherData() {
  const { user, userRole } = useAuth();

  const { data: teacher, isLoading } = useQuery({
    queryKey: ["teacher-data", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("teachers")
        .select("*, schools:school_id(id, name, logo_url)")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && userRole === "teacher",
  });

  const schoolId = teacher?.school_id ?? null;
  const school = teacher?.schools as { id: string; name: string; logo_url: string | null } | null;

  return { teacher, school, schoolId, isLoading };
}
