import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calculatePayrollTotals, convertToVes } from "@/lib/payroll/calculateNet";
import type {
  PayrollCategory,
  PayrollCurrency,
  PayrollLineItem,
  PayrollMethodType,
  PayrollPaymentStatus,
} from "@/lib/payroll/types";

export interface PayrollPaymentFilters {
  periodId?: string;
  status?: string;
}

export interface RegisterPaymentInput {
  period_id: string;
  beneficiary_id: string;
  currency: PayrollCurrency;
  exchange_rate: number;
  payment_method_id?: string | null;
  payment_date?: string | null;
  notes?: string | null;
  items: PayrollLineItem[];
}

/** Payment row with the embedded beneficiary / period / method used by the tables. */
export interface PayrollPaymentRow {
  id: string;
  school_id: string;
  period_id: string;
  beneficiary_id: string;
  status: PayrollPaymentStatus;
  currency: PayrollCurrency;
  exchange_rate: number;
  gross_amount: number;
  deductions_amount: number;
  net_amount: number;
  net_amount_ves: number;
  payment_method_id: string | null;
  payment_date: string | null;
  notes: string | null;
  created_at: string;
  payroll_beneficiaries: {
    id: string;
    full_name: string;
    document_id: string | null;
    category: PayrollCategory;
  } | null;
  payroll_periods: { id: string; name: string; period_type: string } | null;
  payroll_payment_methods: {
    id: string;
    method_type: PayrollMethodType;
    label: string | null;
  } | null;
}

const KEY = "payroll-payments";
const SELECT =
  "*, payroll_beneficiaries(id, full_name, document_id, category), " +
  "payroll_periods(id, name, period_type), " +
  "payroll_payment_methods(id, method_type, label)";

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

async function writeAudit(
  schoolId: string,
  paymentId: string,
  action: string,
  detail: Record<string, unknown> = {}
) {
  const actorId = await currentUserId();
  await supabase
    .from("payroll_audit_log")
    .insert({ school_id: schoolId, payment_id: paymentId, action, actor_id: actorId, detail: detail as never });
}

export function usePayrollPayments(
  schoolId: string | null | undefined,
  filters: PayrollPaymentFilters = {}
) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: [KEY, schoolId, filters.periodId ?? "all", filters.status ?? "all"],
    enabled: !!schoolId,
    queryFn: async (): Promise<PayrollPaymentRow[]> => {
      let q = supabase
        .from("payroll_payments")
        .select(SELECT)
        .eq("school_id", schoolId as string)
        .order("created_at", { ascending: false });
      if (filters.periodId) q = q.eq("period_id", filters.periodId);
      if (filters.status) q = q.eq("status", filters.status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as PayrollPaymentRow[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: [KEY, schoolId] });

  const registerPayment = useMutation({
    mutationFn: async (input: RegisterPaymentInput): Promise<string> => {
      if (!schoolId) throw new Error("Colegio no resuelto");
      const totals = calculatePayrollTotals(input.items);
      const netVes = convertToVes(totals.net, input.currency, input.exchange_rate);
      const createdBy = await currentUserId();
      if (!createdBy) throw new Error("Sesión no válida");

      const { data: payment, error } = await supabase
        .from("payroll_payments")
        .insert({
          school_id: schoolId,
          period_id: input.period_id,
          beneficiary_id: input.beneficiary_id,
          status: "draft",
          currency: input.currency,
          exchange_rate: input.exchange_rate,
          gross_amount: totals.gross,
          deductions_amount: totals.deductions,
          net_amount: totals.net,
          net_amount_ves: netVes,
          payment_method_id: input.payment_method_id ?? null,
          payment_date: input.payment_date ?? null,
          notes: input.notes ?? null,
          created_by: createdBy,
        })
        .select("id")
        .single();
      if (error) throw mapPaymentError(error);

      if (input.items.length > 0) {
        const rows = input.items.map((i) => ({
          payment_id: payment.id,
          concept_id: i.concept_id ?? null,
          concept_kind: i.concept_kind,
          description: i.description ?? null,
          amount: i.amount,
        }));
        const { error: itemsError } = await supabase.from("payroll_payment_items").insert(rows);
        if (itemsError) throw itemsError;
      }

      await writeAudit(schoolId, payment.id, "created", { net: totals.net });
      return payment.id;
    },
    onSuccess: invalidate,
  });

  const approvePayment = useMutation({
    mutationFn: async (paymentId: string) => {
      if (!schoolId) throw new Error("Colegio no resuelto");
      const actorId = await currentUserId();
      const { error } = await supabase
        .from("payroll_payments")
        .update({ status: "approved", approved_by: actorId, approved_at: new Date().toISOString() })
        .eq("id", paymentId)
        .eq("status", "draft");
      if (error) throw error;
      await writeAudit(schoolId, paymentId, "approved");
    },
    onSuccess: invalidate,
  });

  const markPaid = useMutation({
    mutationFn: async ({
      paymentId,
      paymentDate,
    }: {
      paymentId: string;
      paymentDate?: string;
    }): Promise<{ emailSent: boolean }> => {
      if (!schoolId) throw new Error("Colegio no resuelto");
      const actorId = await currentUserId();
      const { error } = await supabase
        .from("payroll_payments")
        .update({
          status: "paid",
          paid_by: actorId,
          paid_at: new Date().toISOString(),
          payment_date: paymentDate ?? new Date().toISOString().slice(0, 10),
        })
        .eq("id", paymentId)
        .eq("status", "approved");
      if (error) throw error;
      await writeAudit(schoolId, paymentId, "paid");

      // Best-effort receipt email; never blocks the payment being marked paid.
      let emailSent = false;
      try {
        const { error: fnError } = await supabase.functions.invoke("send-payroll-receipt", {
          body: { payment_id: paymentId },
        });
        emailSent = !fnError;
      } catch {
        emailSent = false;
      }
      return { emailSent };
    },
    onSuccess: invalidate,
  });

  const voidPayment = useMutation({
    mutationFn: async ({ paymentId, reason }: { paymentId: string; reason: string }) => {
      if (!schoolId) throw new Error("Colegio no resuelto");
      const actorId = await currentUserId();
      const { error } = await supabase
        .from("payroll_payments")
        .update({
          status: "voided",
          voided_by: actorId,
          voided_at: new Date().toISOString(),
          void_reason: reason,
        })
        .eq("id", paymentId);
      if (error) throw error;
      await writeAudit(schoolId, paymentId, "voided", { reason });
    },
    onSuccess: invalidate,
  });

  return {
    payments: query.data ?? [],
    isLoading: query.isLoading,
    registerPayment,
    approvePayment,
    markPaid,
    voidPayment,
  };
}

function mapPaymentError(error: { code?: string; message?: string }): Error {
  if (error?.code === "23505") {
    return new Error("Este beneficiario ya tiene un pago en este período.");
  }
  return new Error(error?.message ?? "Error al registrar el pago");
}
