import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FamilyCreditEntry {
  id: string;
  entry_type: "credit" | "debit";
  amount_ves: number;
  note: string;
  source_payment_id: string | null;
  applied_payment_id: string | null;
  created_at: string;
}

export function useFamilyCredits(familyId?: string | null) {
  const entriesQuery = useQuery({
    queryKey: ["family-credits", familyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("family_credits")
        .select("*")
        .eq("family_id", familyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as FamilyCreditEntry[];
    },
    enabled: !!familyId,
  });

  const entries = entriesQuery.data || [];
  const balance = entries.reduce((s, e) => s + (e.entry_type === "credit" ? e.amount_ves : -e.amount_ves), 0);

  return { entries, balance, isLoading: entriesQuery.isLoading };
}
