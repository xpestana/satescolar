import { sendViaSmtp } from "../_shared/smtp-client.ts";
import { isSchoolModuleActive } from "../_shared/schoolModules.ts";
import { asciiSubject, money } from "../_shared/payrollEmail.ts";

// Prevent SMTP/TLS internal errors from crashing the edge worker.
if (typeof addEventListener === "function") {
  addEventListener("unhandledrejection", (e: any) => {
    console.error("[send-withholding-voucher] unhandledrejection swallowed:", e?.reason ?? e);
    e?.preventDefault?.();
  });
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(value: unknown): string {
  return String(value ?? "—")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function row(label: string, value: unknown): string {
  return `<tr><td style="padding:4px 8px;color:#555">${escapeHtml(label)}</td><td style="padding:4px 8px;text-align:right">${escapeHtml(value)}</td></tr>`;
}

export function buildVoucherHtml(w: any): string {
  const doc = w.payroll_purchase_documents;
  const agent = w.agent_snapshot ?? {};
  const supplier = w.beneficiary_snapshot ?? {};
  const taxLabel = w.tax_type === "vat" ? "IVA" : "ISLR";
  const rate = Number(w.exchange_rate) > 0 ? Number(w.exchange_rate) : 1;
  const totalVes = Math.round((Number(doc?.total_amount) || 0) * rate * 100) / 100;

  return `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111">
    <h2 style="margin:0 0 4px">Comprobante de retención de ${taxLabel}</h2>
    <p style="margin:0 0 16px"><strong>N° ${escapeHtml(w.voucher_number)}</strong></p>
    <p style="margin:0 0 4px"><strong>Agente de retención:</strong> ${escapeHtml(agent.name)} — RIF ${escapeHtml(agent.tax_id)}</p>
    <p style="margin:0 0 12px">${escapeHtml(agent.fiscal_address)}</p>
    <p style="margin:0 0 4px"><strong>Proveedor:</strong> ${escapeHtml(supplier.name)} — RIF ${escapeHtml(supplier.tax_id)}</p>
    <p style="margin:0 0 12px">${escapeHtml(supplier.fiscal_address)}</p>
    <table style="width:100%;border-collapse:collapse;border:1px solid #ddd;font-size:14px">
      ${row("Período de imposición", `${formatDate(w.fiscal_period_start)} al ${formatDate(w.fiscal_period_end)}`)}
      ${row("Fecha de emisión", formatDate(w.issued_at))}
      ${row(doc?.document_type === "debit_note" ? "Nota de débito" : "Factura", doc?.document_number)}
      ${row("N° de control", doc?.control_number)}
      ${row("Fecha del documento", formatDate(doc?.issue_date))}
      ${row("Monto total", money(totalVes, "VES"))}
      ${w.tax_type === "vat"
        ? row("Base imponible", money(Number(w.base_ves), "VES")) + row("Impuesto causado", money(Number(w.tax_amount_ves), "VES"))
        : row("Monto sujeto a retención", money(Number(w.base_ves), "VES"))}
      ${w.islr_concept_name ? row("Concepto", w.islr_concept_name) : ""}
      ${row("Porcentaje de retención", `${w.rate_pct} %`)}
      ${Number(w.subtrahend_ves) > 0 ? row("Sustraendo", money(Number(w.subtrahend_ves), "VES")) : ""}
      <tr style="font-weight:bold;background:#f3f4f6"><td style="padding:6px 8px">Monto retenido</td><td style="padding:6px 8px;text-align:right">${escapeHtml(money(Number(w.withheld_ves), "VES"))}</td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:12px;color:#666">Conserve este comprobante para sus declaraciones.</p>
  </div>`;
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

    const { withholding_id } = await req.json();
    if (!withholding_id) return json({ error: "withholding_id is required" }, 400);

    const { data: withholding, error } = await admin
      .from("payroll_withholdings")
      .select("*, payroll_purchase_documents(document_type, document_number, control_number, issue_date, total_amount)")
      .eq("id", withholding_id)
      .single();
    if (error || !withholding) return json({ error: "Retención no encontrada" }, 404);

    // Authorize: school staff of this school (or an admin), with the withholdings permission.
    const { data: roles } = await admin
      .from("user_roles")
      .select("role, school_id")
      .eq("user_id", user.id);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    const isStaff = (roles ?? []).some((r: any) => r.role === "school" && r.school_id === withholding.school_id);
    if (!isAdmin && !isStaff) return json({ error: "No autorizado" }, 403);
    if (!isAdmin) {
      const { data: allowed } = await admin.rpc("has_permission", { _user_id: user.id, _key: "payroll.withholdings" });
      if (!allowed) return json({ error: "No tiene permiso para gestionar retenciones" }, 403);
      if (!(await isSchoolModuleActive(admin, withholding.school_id, "payments"))) {
        return json({ error: "El módulo de Pagos no está activo en este colegio", status: "module_inactive" }, 403);
      }
    }

    if (!withholding.voucher_number || withholding.status === "voided") {
      return json({ error: "Esta retención no tiene un comprobante vigente" }, 400);
    }

    const to = withholding.beneficiary_snapshot?.email?.trim();
    if (!to) return json({ error: "El proveedor no tiene correo registrado" }, 400);

    const fromEmail = Deno.env.get("SMTP_FROM_EMAIL") ?? "";
    const fromName = Deno.env.get("SMTP_FROM_NAME") ?? "SAT Escolar";
    const taxLabel = withholding.tax_type === "vat" ? "IVA" : "ISLR";

    await sendViaSmtp({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject: asciiSubject(`Comprobante de retencion ${taxLabel} ${withholding.voucher_number}`),
      html: buildVoucherHtml(withholding),
    } as any);

    await admin
      .from("payroll_withholdings")
      .update({ delivered_at: new Date().toISOString() })
      .eq("id", withholding_id);

    return json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[send-withholding-voucher] error:", error);
    return json({ error: message || "Error al enviar el comprobante" }, 500);
  }
}

if (import.meta.main) Deno.serve(handler);
