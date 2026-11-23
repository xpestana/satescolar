import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { clientQueryKeys } from "./clientQueryKeys";

export type ClientAccountUpdate = Omit<TablesUpdate<"client_accounts">, "id" | "school_id" | "created_at" | "updated_at">;

export interface RegisterPaymentInput {
  months: string[];
  status: "paid" | "waived";
  amountUsdPerMonth: number | null;
  paidOn: string;
  method: string;
  reference: string;
  notes: string;
  sendThanks: boolean;
}

export interface RegisterPaymentResult {
  saved: number;
  email: { sent: boolean; error?: string; recipients: string[] } | null;
}

/** Result of a manual reminder or thank-you email. */
export interface SendReminderResult {
  recipients: string[];
  months: string[];
}

/** Admin-only: every change to one client account (data, contacts, payments, emails). */
export function useClientAccountMutations(accountId: string | undefined) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: clientQueryKeys.all });

  const updateAccount = useMutation({
    mutationFn: async (changes: ClientAccountUpdate) => {
      const { error } = await supabase.from("client_accounts").update(changes).eq("id", accountId!);
      if (error) throw error;
    },
    onSettled: refresh,
  });

  const addContact = useMutation({
    mutationFn: async (contact: { name: string; email: string; role_label: string }) => {
      const { error } = await supabase.from("client_billing_contacts").insert({
        client_account_id: accountId!,
        name: contact.name.trim() || null,
        email: contact.email.trim().toLowerCase(),
        role_label: contact.role_label.trim() || null,
      });
      if (error) {
        if (error.code === "23505") throw new Error("Ese correo ya está en la lista de cobro");
        throw error;
      }
    },
    onSettled: refresh,
  });

  const setContactActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase.from("client_billing_contacts").update({ is_active: isActive }).eq("id", id);
      if (error) throw error;
    },
    onSettled: refresh,
  });

  const removeContact = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_billing_contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSettled: refresh,
  });

  const removePayment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_billing_payments").delete().eq("id", id);
      if (error) throw error;
    },
    onSettled: refresh,
  });

  const registerPayment = useMutation({
    mutationFn: (input: RegisterPaymentInput) =>
      invokeEdgeFunction<RegisterPaymentResult>(
        "client-billing",
        {
          action: "register_payment",
          client_account_id: accountId,
          months: input.months,
          status: input.status,
          amount_usd_per_month: input.amountUsdPerMonth,
          paid_on: input.paidOn,
          method: input.method,
          reference: input.reference,
          notes: input.notes,
          send_thanks: input.sendThanks,
        },
        "No se pudo registrar el pago",
      ),
    onSettled: refresh,
  });

  const sendReminder = useMutation({
    mutationFn: () =>
      invokeEdgeFunction<SendReminderResult>(
        "client-billing",
        { action: "send_reminder", client_account_id: accountId },
        "No se pudo enviar el recordatorio",
      ),
    onSettled: refresh,
  });

  const sendThanks = useMutation({
    mutationFn: (months: string[]) =>
      invokeEdgeFunction<SendReminderResult>(
        "client-billing",
        { action: "send_thanks", client_account_id: accountId, months },
        "No se pudo enviar el agradecimiento",
      ),
    onSettled: refresh,
  });

  return {
    updateAccount,
    addContact,
    setContactActive,
    removeContact,
    removePayment,
    registerPayment,
    sendReminder,
    sendThanks,
  };
}
