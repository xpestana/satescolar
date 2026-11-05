import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { toPayrollError } from "@/lib/payroll/withholdings/friendlyPayrollError";
import type { DraftDocument, DraftItem, DraftWithholding } from "@/lib/payroll/withholdings/buildPaymentDraft";
import type { PaymentRegime } from "@/lib/payroll/withholdings/types";
import type {
  PayrollCategory,
  PayrollCurrency,
  PayrollMethodType,
  PayrollPaymentStatus,
} from "@/lib/payroll/types";

export type ReceiptSkipReason = "no-email" | "error";

export interface PayrollPaymentFilters {
  periodId?: string;
  status?: string;
}

export interface RegisterPaymentInput {
  period_id: string;
  beneficiary_id: string;
  payment_kind?: PaymentRegime;
  currency: PayrollCurrency;
  exchange_rate: number;
  payment_method_id?: string | null;
  payment_date?: string | null;
  notes?: string | null;
  items: DraftItem[];
  documents?: DraftDocument[];
  withholdings?: DraftWithholding[];
}

/** Payment row with the embedded beneficiary / period / method used by the tables. */
export interface PayrollPaymentRow {
  id: string;
  school_id: string;
  period_id: string;
  beneficiary_id: string;
  payment_kind: PaymentRegime;
  status: PayrollPaymentStatus;
  currency: PayrollCurrency;
  exchange_rate: number;
  gross_amount: number;
  deductions_amount: number;
  net_amount: number;
  net_amount_ves: number;
  payment_method_id: string | null;
  payment_date: string | null;
  payment_reference: string | null;
  notes: string | null;
  created_at: string;
  payroll_beneficiaries: {
    id: string;
    full_name: string;
    document_id: string | null;
    tax_id: string | null;
    category: PayrollCategory;
  } | null;
  payroll_periods: { id: string; name: string; period_type: string } | null;
  payroll_payment_methods: {
    id: string;
    method_type: PayrollMethodType;
    label: string | null;
  } | null;
  payroll_purchase_documents: { document_number: string }[] | null;
}

const KEY = "payroll-payments";
const SELECT =
  "*, payroll_beneficiaries(id, full_name, document_id, tax_id, category), " +
  "payroll_periods(id, name, period_type), " +
  "payroll_payment_methods(id, method_type, label), " +
  "payroll_purchase_documents(document_number)";

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

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [KEY, schoolId] });
    qc.invalidateQueries({ queryKey: ["payroll-withholdings", schoolId] });
  };

  // Saved in one transaction: a failure can't leave a payment without its lines or withholdings.
  const registerPayment = useMutation({
    mutationFn: async (input: RegisterPaymentInput): Promise<string> => {
      if (!schoolId) throw new Error("Colegio no resuelto");
      const { data, error } = await supabase.rpc("register_payroll_payment_with_withholdings", {
        _payload: { ...input, school_id: schoolId } as unknown as Json,
      });
      if (error) throw toPayrollError(error);
      return data as string;
    },
    onSuccess: invalidate,
  });

  const approvePayment = useMutation({
    mutationFn: async (paymentId: string) => {
      if (!schoolId) throw new Error("Colegio no resuelto");
      const { data: userData } = await supabase.auth.getUser();
      const actorId = userData?.user?.id ?? null;
      const { error } = await supabase
        .from("payroll_payments")
        .update({ status: "approved", approved_by: actorId, approved_at: new Date().toISOString() })
        .eq("id", paymentId)
        .eq("status", "draft");
      if (error) throw toPayrollError(error);
      await supabase
        .from("payroll_audit_log")
        .insert({ school_id: schoolId, payment_id: paymentId, action: "approved", actor_id: actorId, detail: {} });
    },
    onSuccess: invalidate,
  });

  const markPaid = useMutation({
    mutationFn: async ({
      paymentId,
      reference,
      paymentDate,
    }: {
      paymentId: string;
      /** Bank reference of the transfer; required to mark the payment paid. */
      reference: string;
      paymentDate?: string;
    }): Promise<{ emailSent: boolean; reason: ReceiptSkipReason | null }> => {
      if (!schoolId) throw new Error("Colegio no resuelto");
      const { error } = await supabase.rpc("mark_payroll_payment_paid", {
        _payment_id: paymentId,
        _reference: reference,
        _payment_date: paymentDate,
      });
      if (error) throw toPayrollError(error);

      // Best-effort receipt email; never blocks the payment being marked paid. The function answers
      // emailSent: false (not an error) when the beneficiary has no email.
      try {
        const { data, error: fnError } = await supabase.functions.invoke("send-payroll-receipt", {
          body: { payment_id: paymentId },
        });
        if (fnError) return { emailSent: false, reason: "error" };
        if (data?.emailSent === true) return { emailSent: true, reason: null };
        return { emailSent: false, reason: data?.reason === "beneficiary-without-email" ? "no-email" : "error" };
      } catch {
        return { emailSent: false, reason: "error" };
      }
    },
    onSuccess: invalidate,
  });

  const voidPayment = useMutation({
    mutationFn: async ({ paymentId, reason }: { paymentId: string; reason: string }) => {
      if (!schoolId) throw new Error("Colegio no resuelto");
      const { error } = await supabase.rpc("void_payroll_payment", {
        _payment_id: paymentId,
        _reason: reason,
      });
      if (error) throw toPayrollError(error);
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
