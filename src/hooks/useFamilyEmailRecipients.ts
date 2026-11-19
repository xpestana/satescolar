import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buildFamilyRecipients, type FamilyRecipient } from "@/lib/email/familyRecipients";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";

/** Families of the school as bulk-email recipients (account email, with representative fallback). */
export function useFamilyEmailRecipients(schoolId: string | null | undefined) {
  return useQuery({
    queryKey: ["email-families", schoolId],
    enabled: !!schoolId,
    queryFn: async (): Promise<FamilyRecipient[]> => {
      const { data: familySchools, error: fsError } = await supabase
        .from("family_schools")
        .select("family_id")
        .eq("school_id", schoolId as string);
      if (fsError) throw fsError;
      const familyIds = [...new Set((familySchools ?? []).map((fs) => fs.family_id))];
      if (familyIds.length === 0) return [];

      const [familiesRes, repsRes] = await Promise.all([
        supabase.from("families").select("id, user_id, father_last_name, mother_last_name").in("id", familyIds),
        supabase.from("representatives").select("family_id, is_primary, email, form_data").in("family_id", familyIds),
      ]);
      if (familiesRes.error) throw familiesRes.error;
      if (repsRes.error) throw repsRes.error;

      const userIds = [...new Set((familiesRes.data ?? []).map((f) => f.user_id).filter(Boolean))] as string[];
      const emails = userIds.length
        ? (
            await invokeEdgeFunction<{ emails?: Record<string, string> }>(
              "get-user-emails",
              { user_ids: userIds },
              "No se pudieron cargar los correos de las familias",
            )
          ).emails ?? {}
        : {};

      return buildFamilyRecipients(
        familiesRes.data ?? [],
        (repsRes.data ?? []) as Parameters<typeof buildFamilyRecipients>[1],
        emails,
      );
    },
  });
}
