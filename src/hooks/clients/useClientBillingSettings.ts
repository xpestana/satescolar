import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { clientQueryKeys } from "./clientQueryKeys";

export type ClientBillingSettings = Pick<
  Tables<"client_billing_settings">,
  "reminder_days" | "payment_instructions" | "contact_phone"
>;

/** Admin-only: platform-wide billing settings (reminder days, payment details, WhatsApp). */
export function useClientBillingSettings() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: clientQueryKeys.settings(),
    queryFn: async (): Promise<ClientBillingSettings> => {
      const { data, error } = await supabase
        .from("client_billing_settings")
        .select("reminder_days, payment_instructions, contact_phone")
        .maybeSingle();
      if (error) throw error;
      return data ?? { reminder_days: [15], payment_instructions: null, contact_phone: null };
    },
  });

  const save = useMutation({
    mutationFn: async (settings: ClientBillingSettings) => {
      const { error } = await supabase.from("client_billing_settings").upsert({ id: true, ...settings });
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: clientQueryKeys.settings() }),
  });

  return { settings: query.data, isLoading: query.isLoading, save };
}
