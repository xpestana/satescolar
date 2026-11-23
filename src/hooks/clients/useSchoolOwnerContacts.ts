import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { clientQueryKeys } from "./clientQueryKeys";

export interface SchoolOwnerContact {
  userId: string;
  email: string;
  fullName: string | null;
}

/** Admin-only: owner users ("usuario principal") of every school, grouped by school id. */
export function useSchoolOwnerContacts() {
  return useQuery({
    queryKey: clientQueryKeys.owners(),
    queryFn: async (): Promise<Map<string, SchoolOwnerContact[]>> => {
      const { data, error } = await supabase.rpc("admin_school_owner_contacts");
      if (error) throw error;
      const bySchool = new Map<string, SchoolOwnerContact[]>();
      for (const row of data ?? []) {
        const list = bySchool.get(row.school_id) ?? [];
        list.push({ userId: row.user_id, email: row.email, fullName: row.full_name });
        bySchool.set(row.school_id, list);
      }
      return bySchool;
    },
  });
}
