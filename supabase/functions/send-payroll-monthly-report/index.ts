import { sendViaSmtp } from "../_shared/smtp-client.ts";
import {
  buildMonthlyReportHtml,
  money,
  type MonthlyReportData,
  type ReportBucket,
} from "../_shared/payrollEmail.ts";

if (typeof addEventListener === "function") {
  addEventListener("unhandledrejection", (e: any) => {
    console.error("[send-payroll-monthly-report] unhandledrejection swallowed:", e?.reason ?? e);
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

/** Detect a service-role caller (cron / server) by reading the JWT role claim.
 *  Robust to service-key rotation, unlike comparing against an env value. */
function isServiceRoleToken(token: string): boolean {
  try {
    const part = token.split(".")[1];
    const payload = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    return payload?.role === "service_role";
  } catch {
    return false;
  }
}

/** [start, endExclusive, label] for the target month (defaults to previous month). */
function monthRange(year?: number, month?: number): [string, string, string] {
  const now = new Date();
  let y = year ?? now.getUTCFullYear();
  let m = month ?? now.getUTCMonth(); // 0-based; default = previous month (current index - 1 + 1)
  if (year === undefined || month === undefined) {
    // Default to previous calendar month.
    const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    y = prev.getUTCFullYear();
    m = prev.getUTCMonth();
  } else {
    m = month - 1; // caller passes 1-based month
  }
  const start = new Date(Date.UTC(y, m, 1));
  const end = new Date(Date.UTC(y, m + 1, 1));
  const label = start.toLocaleDateString("es-VE", { month: "long", year: "numeric", timeZone: "UTC" });
  return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10), label];
}

async function reportForSchool(
  admin: any,
  schoolId: string,
  startDate: string,
  endDate: string,
  monthLabel: string
): Promise<{ emailed: boolean; reason?: string }> {
  const { data: payments } = await admin
    .from("payroll_payments")
    .select("net_amount_ves, payroll_beneficiaries(category), payroll_payment_methods(method_type, label)")
    .eq("school_id", schoolId)
    .eq("status", "paid")
    .gte("payment_date", startDate)
    .lt("payment_date", endDate);

  const list = payments ?? [];
  // Don't email a report for a month with no payroll activity (avoids noise).
  if (list.length === 0) return { emailed: false, reason: "no-payments" };

  const catTotals: Record<string, number> = {};
  const methodTotals: Record<string, number> = {};
  let totalVes = 0;
  for (const p of list) {
    const ves = Number(p.net_amount_ves) || 0;
    totalVes += ves;
    const cat = p.payroll_beneficiaries?.category ?? "other";
    catTotals[cat] = (catTotals[cat] ?? 0) + ves;
    const mt = p.payroll_payment_methods?.method_type ?? "unknown";
    methodTotals[mt] = (methodTotals[mt] ?? 0) + ves;
  }

  // Resolve the school owner's email.
  const { data: ownerRole } = await admin
    .from("user_roles")
    .select("user_id")
    .eq("school_id", schoolId)
    .eq("role", "school")
    .eq("is_owner", true)
    .maybeSingle();
  if (!ownerRole?.user_id) return { emailed: false, reason: "no-owner" };

  const { data: ownerUser } = await admin.auth.admin.getUserById(ownerRole.user_id);
  const to = ownerUser?.user?.email;
  if (!to) return { emailed: false, reason: "owner-without-email" };

  const { data: school } = await admin.from("schools").select("name").eq("id", schoolId).single();

  const byCategory: ReportBucket[] = Object.entries(catTotals).map(([k, v]) => ({
    label: CATEGORY_LABELS[k] ?? k,
    amount: v as number,
  }));
  const byMethod: ReportBucket[] = Object.entries(methodTotals).map(([k, v]) => ({
    label: METHOD_LABELS[k] ?? k,
    amount: v as number,
  }));

  const data: MonthlyReportData = {
    schoolName: school?.name ?? "SAT Escolar",
    monthLabel,
    paymentsCount: list.length,
    totalVes,
    byCategory,
    byMethod,
  };

  const fromEmail = Deno.env.get("SMTP_FROM_EMAIL") ?? "";
  const fromName = Deno.env.get("SMTP_FROM_NAME") ?? "SAT Escolar";
  await sendViaSmtp({
    from: `${fromName} <${fromEmail}>`,
    to: [to],
    subject: `Reporte de nómina — ${monthLabel} (${money(totalVes, "VES")})`,
    html: buildMonthlyReportHtml(data),
  } as any);

  return { emailed: true };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "No authorization header" }, 401);

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const body = await req.json().catch(() => ({}));
    const [startDate, endDate, monthLabel] = monthRange(body.year, body.month);

    // System/cron mode: caller presents a service-role JWT -> process all (or one) schools.
    const isSystem = isServiceRoleToken(token);

    let schoolIds: string[] = [];
    if (isSystem) {
      if (body.school_id) {
        schoolIds = [body.school_id];
      } else {
        const { data: schools } = await admin.from("schools").select("id");
        schoolIds = (schools ?? []).map((s: any) => s.id);
      }
    } else {
      // User mode: restrict to the caller's school.
      const { data: { user } } = await admin.auth.getUser(token);
      if (!user) return json({ error: "Invalid token" }, 401);
      const { data: roles } = await admin
        .from("user_roles")
        .select("school_id")
        .eq("user_id", user.id)
        .eq("role", "school");
      schoolIds = (roles ?? []).map((r: any) => r.school_id).filter(Boolean);
      if (schoolIds.length === 0) return json({ error: "No autorizado" }, 403);
    }

    let emailsSent = 0;
    const results: Record<string, string> = {};
    for (const schoolId of schoolIds) {
      try {
        const r = await reportForSchool(admin, schoolId, startDate, endDate, monthLabel);
        if (r.emailed) emailsSent++;
        results[schoolId] = r.emailed ? "sent" : (r.reason ?? "skipped");
      } catch (e) {
        results[schoolId] = `error: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    return json({ success: true, month: monthLabel, schools: schoolIds.length, emailsSent, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[send-payroll-monthly-report] error:", error);
    return json({ error: message || "Error al generar el reporte" }, 500);
  }
}

if (import.meta.main) Deno.serve(handler);
