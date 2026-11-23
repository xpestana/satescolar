/**
 * Loads what a billing email needs for one client account (service-role client): the account,
 * the school, its owner emails ("usuario principal"), extra contacts, settled months and the
 * platform billing settings. Also records every email in `client_billing_emails`.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { collectBillingRecipients } from "./billingRecipients.ts";

export interface ClientAccountRow {
  id: string;
  school_id: string;
  account_type: "demo" | "client" | "inactive";
  monthly_fee_usd: number | null;
  billing_start_month: string | null;
  contact_name: string | null;
  notify_owner: boolean;
  reminders_enabled: boolean;
}

type AccountWithSchool = ClientAccountRow & { schools: { name: string | null } | null };

export interface BillingSettings {
  reminder_days: number[];
  payment_instructions: string | null;
  contact_phone: string | null;
}

export interface ClientBillingContext {
  account: ClientAccountRow;
  schoolName: string;
  recipients: string[];
  settledMonths: string[];
}

const ACCOUNT_COLUMNS =
  "id, school_id, account_type, monthly_fee_usd, billing_start_month, contact_name, notify_owner, reminders_enabled, schools(name)";

export async function loadBillingSettings(admin: SupabaseClient): Promise<BillingSettings> {
  const { data, error } = await admin
    .from("client_billing_settings")
    .select("reminder_days, payment_instructions, contact_phone")
    .maybeSingle();
  if (error) throw error;
  return {
    reminder_days: data?.reminder_days ?? [15],
    payment_instructions: data?.payment_instructions ?? null,
    contact_phone: data?.contact_phone ?? null,
  };
}

async function ownerEmailsBySchool(admin: SupabaseClient, schoolIds: string[]): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (schoolIds.length === 0) return result;
  const { data, error } = await admin
    .from("user_roles")
    .select("user_id, school_id")
    .eq("role", "school")
    .eq("is_owner", true)
    .in("school_id", schoolIds);
  if (error) throw error;
  for (const row of data ?? []) {
    const { data: userData } = await admin.auth.admin.getUserById(row.user_id);
    const email = userData?.user?.email;
    if (!email) continue;
    result.set(row.school_id, [...(result.get(row.school_id) ?? []), email]);
  }
  return result;
}

async function buildContexts(admin: SupabaseClient, accounts: AccountWithSchool[]): Promise<ClientBillingContext[]> {
  if (accounts.length === 0) return [];
  const ids = accounts.map((a) => a.id);
  const [owners, { data: contacts, error: cErr }, { data: payments, error: pErr }] = await Promise.all([
    ownerEmailsBySchool(admin, accounts.map((a) => a.school_id)),
    admin.from("client_billing_contacts").select("client_account_id, email, is_active").in("client_account_id", ids),
    admin.from("client_billing_payments").select("client_account_id, period_month").in("client_account_id", ids),
  ]);
  if (cErr) throw cErr;
  if (pErr) throw pErr;

  return accounts.map((account) => ({
    account,
    schoolName: account.schools?.name ?? "su institución",
    recipients: collectBillingRecipients({
      ownerEmails: owners.get(account.school_id) ?? [],
      notifyOwner: account.notify_owner,
      contacts: (contacts ?? []).filter((c) => c.client_account_id === account.id),
    }),
    settledMonths: (payments ?? []).filter((p) => p.client_account_id === account.id).map((p) => p.period_month),
  }));
}

export async function loadClientBillingContext(admin: SupabaseClient, accountId: string): Promise<ClientBillingContext | null> {
  const { data, error } = await admin.from("client_accounts").select(ACCOUNT_COLUMNS).eq("id", accountId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return (await buildContexts(admin, [data as unknown as AccountWithSchool]))[0];
}

/** Real clients with automatic reminders on (the cron's population). */
export async function loadRemindableContexts(admin: SupabaseClient): Promise<ClientBillingContext[]> {
  const { data, error } = await admin
    .from("client_accounts")
    .select(ACCOUNT_COLUMNS)
    .eq("account_type", "client")
    .eq("reminders_enabled", true)
    .not("billing_start_month", "is", null);
  if (error) throw error;
  return buildContexts(admin, (data ?? []) as unknown as AccountWithSchool[]);
}

export async function logBillingEmail(
  admin: SupabaseClient,
  entry: {
    client_account_id: string;
    kind: "reminder" | "thanks";
    recipients: string[];
    subject: string;
    months: string[];
    sent: boolean;
    error?: string | null;
    triggered_by: "admin" | "cron";
    sent_by?: string | null;
  },
): Promise<void> {
  const { error } = await admin.from("client_billing_emails").insert({
    client_account_id: entry.client_account_id,
    kind: entry.kind,
    recipients: entry.recipients,
    subject: entry.subject,
    months: entry.months,
    status: entry.sent ? "sent" : "failed",
    error_message: entry.sent ? null : (entry.error ?? "Error desconocido"),
    triggered_by: entry.triggered_by,
    sent_by: entry.sent_by ?? null,
  });
  if (error) console.error("[client-billing] could not log email:", error);
}

/** Whether a reminder already went out to this account since `sinceIso` (avoid duplicates). */
export async function reminderSentSince(admin: SupabaseClient, accountId: string, sinceIso: string): Promise<boolean> {
  const { data } = await admin
    .from("client_billing_emails")
    .select("id")
    .eq("client_account_id", accountId)
    .eq("kind", "reminder")
    .eq("status", "sent")
    .gte("sent_at", sinceIso)
    .limit(1);
  return (data ?? []).length > 0;
}
