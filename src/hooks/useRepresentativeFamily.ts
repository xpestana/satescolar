import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useRepresentativeFamily() {
  const { user, userRole } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["representative-family", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // Get family owned by this user
      const { data: family, error: famErr } = await supabase
        .from("families")
        .select("id, father_last_name, mother_last_name")
        .eq("user_id", user.id)
        .single();

      if (famErr || !family) return null;

      // Get school via family_schools
      const { data: fs } = await supabase
        .from("family_schools")
        .select("school_id")
        .eq("family_id", family.id)
        .limit(1)
        .single();

      // Get school details for carnet
      let school = null;
      if (fs?.school_id) {
        const { data: s } = await supabase
          .from("schools")
          .select("id, name, logo_url, dea_code, address, state_id, municipality_id, city_id, parish_id")
          .eq("id", fs.school_id)
          .single();
        school = s;
      }

      return {
        familyId: family.id,
        familyName: `${family.father_last_name || ""} ${family.mother_last_name || ""}`.trim() || "Mi Familia",
        schoolId: fs?.school_id || null,
        school,
      };
    },
    enabled: !!user?.id && userRole === "representative",
  });

  return {
    familyId: data?.familyId || null,
    familyName: data?.familyName || "Mi Familia",
    schoolId: data?.schoolId || null,
    school: data?.school || null,
    isLoading,
  };
}
