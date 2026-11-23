import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { clientQueryKeys } from "./clientQueryKeys";

export type ClientAccount = Tables<"client_accounts">;
export type ClientContact = Tables<"client_billing_contacts">;
export type ClientPayment = Tables<"client_billing_payments">;
export type ClientEmailLog = Tables<"client_billing_emails">;

export interface ClientAccountDetail {
  account: ClientAccount;
  school: { id: string; name: string; email: string | null; phone: string | null; logo_url: string | null; rif: string | null };
  contacts: ClientContact[];
  payments: ClientPayment[];
}

/** Admin-only: one client account with its school, billing contacts and recorded months. */
export function useClientAccount(accountId: string | undefined) {
  return useQuery({
    queryKey: clientQueryKeys.detail(accountId),
    enabled: !!accountId,
    queryFn: async (): Promise<ClientAccountDetail | null> => {
      const { data: account, error } = await supabase
        .from("client_accounts")
        .select("*, schools(id, name, email, phone, logo_url, rif)")
        .eq("id", accountId!)
        .maybeSingle();
      if (error) throw error;
      if (!account) return null;

      const [contactsRes, paymentsRes] = await Promise.all([
        supabase.from("client_billing_contacts").select("*").eq("client_account_id", accountId!).order("created_at"),
        supabase
          .from("client_billing_payments")
          .select("*")
          .eq("client_account_id", accountId!)
          .order("period_month", { ascending: false }),
      ]);
      if (contactsRes.error) throw contactsRes.error;
      if (paymentsRes.error) throw paymentsRes.error;

      const { schools, ...rest } = account;
      return { account: rest as ClientAccount, school: schools, contacts: contactsRes.data, payments: paymentsRes.data };
    },
  });
}

/** Admin-only: billing emails sent to one client (latest first). */
export function useClientEmailLog(accountId: string | undefined) {
  return useQuery({
    queryKey: clientQueryKeys.emails(accountId),
    enabled: !!accountId,
    queryFn: async (): Promise<ClientEmailLog[]> => {
      const { data, error } = await supabase
        .from("client_billing_emails")
        .select("*")
        .eq("client_account_id", accountId!)
        .order("sent_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });
}
