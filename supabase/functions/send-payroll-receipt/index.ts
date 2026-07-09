import { sendViaSmtp } from "../_shared/smtp-client.ts";
import {
  buildReceiptHtml,
  type Currency,
  type ReceiptEmailData,
  type ReceiptLine,
} from "../_shared/payrollEmail.ts";

// Prevent SMTP/TLS internal errors from crashing the edge worker.
if (typeof addEventListener === "function") {
  addEventListener("unhandledrejection", (e: any) => {
    console.error("[send-payroll-receipt] unhandledrejection swallowed:", e?.reason ?? e);
    e?.preventDefault?.();
  });
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CATEGORY_LABELS: Record<string, string> = {
  teacher: "Docente",
  admin: "Administrativo",
  worker: "Obrero",
  other: "Otros",
};
const METHOD_LABELS: Record<string, string> = {
  transfer: "Transferencia",
  mobile_payment: "Pago móvil",
  cash: "Efectivo",
  check: "Cheque",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value.length <= 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-VE", { day: "2-digit", month: "long", year: "numeric" });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No authorization header" }, 401);

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return json({ error: "Invalid token" }, 401);

    const { payment_id } = await req.json();
    if (!payment_id) return json({ error: "payment_id is required" }, 400);

    // Load the payment with its relations.
    const { data: payment, error: pErr } = await admin
      .from("payroll_payments")
      .select(
        "*, payroll_beneficiaries(full_name, document_id, category, email), " +
          "payroll_periods(name), payroll_payment_methods(method_type, label)"
      )
      .eq("id", payment_id)
      .single();
    if (pErr || !payment) return json({ error: "Pago no encontrado" }, 404);

    // Authorize: caller must belong to the payment's school (or be admin).
    const { data: roles } = await admin
      .from("user_roles")
      .select("role, school_id")
      .eq("user_id", user.id);
    const allowed = (roles ?? []).some(
      (r: any) => r.role === "admin" || r.school_id === payment.school_id
    );
    if (!allowed) return json({ error: "No autorizado" }, 403);

    const beneficiary = payment.payroll_beneficiaries;
    const to = beneficiary?.email?.trim();
    if (!to) return json({ success: true, emailSent: false, reason: "beneficiary-without-email" });

    // Items -> earnings / deductions.
    const { data: items } = await admin
      .from("payroll_payment_items")
      .select("concept_kind, description, amount")
      .eq("payment_id", payment_id);

    const currency = (payment.currency as Currency) ?? "VES";
    const earnings: ReceiptLine[] = [];
    const deductions: ReceiptLine[] = [];
    for (const it of items ?? []) {
      const line = { description: it.description || "Concepto", amount: Number(it.amount) || 0 };
      if (it.concept_kind === "deduction") deductions.push(line);
      else earnings.push(line);
    }

    const { data: school } = await admin
      .from("schools")
      .select("name")
      .eq("id", payment.school_id)
      .single();

    const data: ReceiptEmailData = {
      schoolName: school?.name ?? "SAT Escolar",
      beneficiaryName: beneficiary?.full_name ?? "—",
      documentId: beneficiary?.document_id ?? "—",
      categoryLabel: CATEGORY_LABELS[beneficiary?.category] ?? "—",
      periodName: payment.payroll_periods?.name ?? "—",
      currency,
      exchangeRate: Number(payment.exchange_rate) || 0,
      earnings,
      deductions,
      gross: Number(payment.gross_amount) || 0,
      deductionsTotal: Number(payment.deductions_amount) || 0,
      net: Number(payment.net_amount) || 0,
      netVes: Number(payment.net_amount_ves) || 0,
      methodLabel: payment.payroll_payment_methods
        ? payment.payroll_payment_methods.label || METHOD_LABELS[payment.payroll_payment_methods.method_type] || "—"
        : "—",
      paymentDate: formatDate(payment.payment_date),
      notes: payment.notes ?? "",
    };

    const fromEmail = Deno.env.get("SMTP_FROM_EMAIL") ?? "";
    const fromName = Deno.env.get("SMTP_FROM_NAME") ?? "SAT Escolar";

    await sendViaSmtp({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject: `Recibo de pago — ${data.periodName}`,
      html: buildReceiptHtml(data),
    } as any);

    return json({ success: true, emailSent: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[send-payroll-receipt] error:", error);
    return json({ error: message || "Error al enviar el recibo" }, 500);
  }
}

if (import.meta.main) Deno.serve(handler);
