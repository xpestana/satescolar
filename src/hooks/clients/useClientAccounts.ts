import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { currentMonthKey } from "@/lib/clients/currentMonthKey";
import { summarizeClientBilling, type ClientBillingSnapshot } from "@/lib/clients/clientBillingStatus";
import { clientQueryKeys } from "./clientQueryKeys";
import { useSchoolOwnerContacts, type SchoolOwnerContact } from "./useSchoolOwnerContacts";

export interface ClientListItem {
  id: string;
  schoolId: string;
  schoolName: string;
  schoolEmail: string | null;
  schoolPhone: string | null;
  logoUrl: string | null;
  schoolCreatedAt: string;
  accountType: string;
  monthlyFeeUsd: number | null;
  billingStartMonth: string | null;
  demoEndsOn: string | null;
  contactName: string | null;
  contactPhone: string | null;
  notifyOwner: boolean;
  remindersEnabled: boolean;
  hasObservations: boolean;
  activeContacts: number;
  owners: SchoolOwnerContact[];
  snapshot: ClientBillingSnapshot;
}

/** Admin-only: every client account (one per school) with its billing status. */
export function useClientAccounts() {
  const owners = useSchoolOwnerContacts();

  const accounts = useQuery({
    queryKey: clientQueryKeys.list(),
    queryFn: async () => {
      const [accountsRes, paymentsRes, contactsRes] = await Promise.all([
        supabase
          .from("client_accounts")
          .select("*, schools(name, email, phone, logo_url, created_at)")
          .order("created_at", { ascending: false }),
        supabase.from("client_billing_payments").select("client_account_id, period_month"),
        supabase.from("client_billing_contacts").select("client_account_id, is_active"),
      ]);
      if (accountsRes.error) throw accountsRes.error;
      if (paymentsRes.error) throw paymentsRes.error;
      if (contactsRes.error) throw contactsRes.error;
      return { accounts: accountsRes.data, payments: paymentsRes.data, contacts: contactsRes.data };
    },
  });

  const items = useMemo<ClientListItem[]>(() => {
    if (!accounts.data) return [];
    const currentMonth = currentMonthKey();
    const settledByAccount = new Map<string, string[]>();
    for (const p of accounts.data.payments) {
      settledByAccount.set(p.client_account_id, [...(settledByAccount.get(p.client_account_id) ?? []), p.period_month]);
    }
    return accounts.data.accounts.map((a) => ({
      id: a.id,
      schoolId: a.school_id,
      schoolName: a.schools?.name ?? "Colegio",
      schoolEmail: a.schools?.email ?? null,
      schoolPhone: a.schools?.phone ?? null,
      logoUrl: a.schools?.logo_url ?? null,
      schoolCreatedAt: a.schools?.created_at ?? a.created_at,
      accountType: a.account_type,
      monthlyFeeUsd: a.monthly_fee_usd,
      billingStartMonth: a.billing_start_month,
      demoEndsOn: a.demo_ends_on,
      contactName: a.contact_name,
      contactPhone: a.contact_phone,
      notifyOwner: a.notify_owner,
      remindersEnabled: a.reminders_enabled,
      hasObservations: !!a.observations?.trim(),
      activeContacts: accounts.data.contacts.filter((c) => c.client_account_id === a.id && c.is_active).length,
      owners: owners.data?.get(a.school_id) ?? [],
      snapshot: summarizeClientBilling({
        accountType: a.account_type,
        startMonth: a.billing_start_month,
        monthlyFeeUsd: a.monthly_fee_usd,
        settledMonths: settledByAccount.get(a.id) ?? [],
        currentMonth,
      }),
    }));
  }, [accounts.data, owners.data]);

  return {
    items,
    isLoading: accounts.isLoading,
    error: accounts.error ?? owners.error,
  };
}
