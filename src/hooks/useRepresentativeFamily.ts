import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { personSurname, resolveFamilySurname } from "@/lib/familyDisplayName";

export function useRepresentativeFamily() {
  const { user, userRole, context } = useAuth();
  // Family and school come resolved with the auth context (get_my_context), so the family row and
  // the school details are fetched in parallel instead of family → family_schools → schools.
  const contextFamilyId = context?.familyId ?? null;
  const contextSchoolId = context?.schoolId ?? null;

  const { data, isLoading } = useQuery({
    queryKey: ["representative-family", user?.id, contextFamilyId, contextSchoolId],
    queryFn: async () => {
      if (!user?.id || !contextFamilyId) return null;

      const [{ data: family, error: famErr }, schoolResult] = await Promise.all([
        supabase
          .from("families")
          .select("id, father_last_name, mother_last_name")
          .eq("id", contextFamilyId)
          .single(),
        contextSchoolId
          ? supabase
              .from("schools")
              .select("id, name, logo_url, dea_code, address, state_id, municipality_id, city_id, parish_id")
              .eq("id", contextSchoolId)
              .single()
          : Promise.resolve({ data: null }),
      ]);

      if (famErr || !family) return null;

      // School details for carnet
      const school = schoolResult.data ?? null;

      // Surname fallbacks: family → primary representative → student
      let primaryRepFormData: Record<string, unknown> | null = null;
      let studentFormData: Record<string, unknown> | null = null;
      const own = [family.father_last_name, family.mother_last_name].filter(Boolean).join(" ").trim();
      if (!own) {
        const { data: reps } = await supabase
          .from("representatives")
          .select("form_data, is_primary")
          .eq("family_id", family.id)
          .order("is_primary", { ascending: false })
          .order("created_at")
          .limit(1);
        primaryRepFormData = (reps?.[0]?.form_data as Record<string, unknown> | null) ?? null;

        if (!personSurname(primaryRepFormData)) {
          const { data: studs } = await supabase
            .from("students")
            .select("form_data")
            .eq("family_id", family.id)
            .order("created_at")
            .limit(1);
          studentFormData = (studs?.[0]?.form_data as Record<string, unknown> | null) ?? null;
        }
      }

      return {
        familyId: family.id,
        familyName:
          resolveFamilySurname(family, primaryRepFormData, studentFormData) || "Mi Familia",
        schoolId: contextSchoolId,
        school,
      };
    },
    enabled: !!user?.id && userRole === "representative" && !!contextFamilyId,
    staleTime: 5 * 60_000,
  });

  return {
    // Ids are known from the auth context before this query answers: pages can start right away.
    familyId: data?.familyId || contextFamilyId,
    familyName: data?.familyName || "Mi Familia",
    schoolId: data?.schoolId || contextSchoolId,
    school: data?.school || null,
    isLoading,
  };
}
