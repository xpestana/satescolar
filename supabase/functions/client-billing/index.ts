import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mailer } from "../_shared/email/mailer.ts";
import { getCallerRole, type UserRolesReader } from "../_shared/callerRole.ts";
import { bearerToken, verifyServiceRoleToken } from "../_shared/serviceRole.ts";
import { localDateParts, normalizeMonthKey, pendingMonths } from "../_shared/billing/billingMonths.ts";
import { buildReminderEmail, buildThanksEmail } from "../_shared/billing/billingEmails.ts";
import {
  type BillingSettings,
  type ClientBillingContext,
  loadBillingSettings,
  loadClientBillingContext,
  loadRemindableContexts,
  logBillingEmail,
  reminderSentSince,
} from "../_shared/billing/clientBillingData.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const parseMonths = (value: unknown): string[] =>
  [...new Set((Array.isArray(value) ? value : []).map((m) => normalizeMonthKey(String(m))).filter((m): m is string => !!m))];

/** Caracas has no DST: its calendar day starts at 04:00 UTC. */
const startOfLocalDayIso = (date: string) => `${date}T04:00:00Z`;

type Admin = SupabaseClient;

async function sendReminder(
  admin: Admin,
  ctx: ClientBillingContext,
  settings: BillingSettings,
  currentMonth: string,
  by: { triggered_by: "admin" | "cron"; sent_by?: string | null },
) {
  const months = pendingMonths({
    startMonth: ctx.account.billing_start_month,
    currentMonth,
    settledMonths: ctx.settledMonths,
  });
  if (months.length === 0) return { sent: false, skipped: "up_to_date" as const, recipients: [] as string[] };

  const { subject, html } = buildReminderEmail({
    schoolName: ctx.schoolName,
    contactName: ctx.account.contact_name,
    pendingMonths: months,
    monthlyFeeUsd: ctx.account.monthly_fee_usd,
    paymentInstructions: settings.payment_instructions,
    contactPhone: settings.contact_phone,
  });

  if (ctx.recipients.length === 0) {
    await logBillingEmail(admin, {
      client_account_id: ctx.account.id,
      kind: "reminder",
      recipients: [],
      subject,
      months,
      sent: false,
      error: "Sin destinatarios: active el usuario principal o agregue un correo de cobro",
      ...by,
    });
    return { sent: false, skipped: "no_recipients" as const, recipients: [] as string[] };
  }

  const result = await mailer.send({ to: ctx.recipients, subject, html });
  await logBillingEmail(admin, {
    client_account_id: ctx.account.id,
    kind: "reminder",
    recipients: ctx.recipients,
    subject,
    months,
    sent: result.sent,
    error: result.error,
    ...by,
  });
  return { sent: result.sent, error: result.error, recipients: ctx.recipients, months };
}

/** Thank-you email for `months` (paid), sent to the client's recipients and logged. */
async function sendThanks(admin: Admin, ctx: ClientBillingContext, months: string[], currentMonth: string, userId: string) {
  const remaining = pendingMonths({
    startMonth: ctx.account.billing_start_month,
    currentMonth,
    settledMonths: [...ctx.settledMonths, ...months],
  });
  const { subject, html } = buildThanksEmail({
    schoolName: ctx.schoolName,
    contactName: ctx.account.contact_name,
    paidMonths: months,
    remainingMonths: remaining,
  });
  let email: { sent: boolean; error?: string; recipients: string[] };
  if (ctx.recipients.length === 0) {
    email = { sent: false, error: "No hay destinatarios para el agradecimiento", recipients: [] };
  } else if (!mailer.isConfigured()) {
    email = { sent: false, error: "El envío de correos no está configurado en el servidor", recipients: ctx.recipients };
  } else {
    const result = await mailer.send({ to: ctx.recipients, subject, html });
    email = { sent: result.sent, error: result.error, recipients: ctx.recipients };
  }
  await logBillingEmail(admin, {
    client_account_id: ctx.account.id,
    kind: "thanks",
    recipients: email.recipients,
    subject,
    months,
    sent: email.sent,
    error: email.error,
    triggered_by: "admin",
    sent_by: userId,
  });
  return email;
}

/**
 * Billing of SAT Escolar's client schools (/admin/clientes).
 * - `run_reminders` — daily cron (verified service-role key). Sends the reminder on the configured
 *   days of the month to every real client with pending months (at most one per client per day).
 * - `send_reminder` — admin: sends the reminder to one client now.
 * - `register_payment` — admin: marks several months as paid/waived and, optionally, sends the
 *   thank-you email.
 * - `send_thanks` — admin: (re)sends the thank-you email for months already recorded as paid.
 */
export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const token = bearerToken(req);
    if (!token) return json({ error: "No autorizado" }, 401);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");
    const today = localDateParts(new Date());

    // ── Cron ──
    if (action === "run_reminders") {
      if (!(await verifyServiceRoleToken(token, { supabaseUrl, serviceRoleKey }))) {
        return json({ error: "Solo el sistema puede ejecutar los recordatorios" }, 403);
      }
      if (!mailer.isConfigured()) return json({ error: "El envío de correos no está configurado en el servidor" }, 503);
      const settings = await loadBillingSettings(admin);
      if (!body.force && !settings.reminder_days.includes(today.day)) {
        return json({ success: true, skipped: `Hoy (${today.day}) no es día de recordatorio` });
      }
      let sent = 0;
      let failed = 0;
      for (const ctx of await loadRemindableContexts(admin)) {
        if (await reminderSentSince(admin, ctx.account.id, startOfLocalDayIso(today.date))) continue;
        const result = await sendReminder(admin, ctx, settings, today.month, { triggered_by: "cron" });
        if (result.sent) sent++;
        else if (result.skipped !== "up_to_date") failed++;
      }
      return json({ success: true, sent, failed });
    }

    // ── Admin actions ──
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return json({ error: "Sesión inválida" }, 401);
    if (!(await getCallerRole(admin as unknown as UserRolesReader, user.id, ["admin"]))) {
      return json({ error: "Solo el administrador de la plataforma puede gestionar cobros" }, 403);
    }

    const accountId = String(body?.client_account_id ?? "");
    if (!accountId) return json({ error: "Falta el cliente" }, 400);
    const ctx = await loadClientBillingContext(admin, accountId);
    if (!ctx) return json({ error: "Cliente no encontrado" }, 404);

    if (action === "send_reminder") {
      if (!mailer.isConfigured()) return json({ error: "El envío de correos no está configurado en el servidor" }, 503);
      const settings = await loadBillingSettings(admin);
      const result = await sendReminder(admin, ctx, settings, today.month, { triggered_by: "admin", sent_by: user.id });
      if (result.skipped === "up_to_date") return json({ error: "Este cliente está al día: no hay meses pendientes" }, 400);
      if (result.skipped === "no_recipients") {
        return json({ error: "No hay destinatarios: active el usuario principal o agregue un correo de cobro" }, 400);
      }
      if (!result.sent) return json({ error: `No se pudo enviar el recordatorio: ${result.error ?? "error desconocido"}` }, 502);
      return json({ success: true, recipients: result.recipients, months: result.months });
    }

    if (action === "register_payment") {
      const months = parseMonths(body.months);
      if (months.length === 0) return json({ error: "Seleccione al menos un mes" }, 400);
      const status = body.status === "waived" ? "waived" : "paid";
      const amount = body.amount_usd_per_month === null || body.amount_usd_per_month === undefined || body.amount_usd_per_month === ""
        ? null
        : Number(body.amount_usd_per_month);
      if (amount !== null && (!Number.isFinite(amount) || amount < 0)) return json({ error: "Monto inválido" }, 400);
      const paidOn = /^\d{4}-\d{2}-\d{2}$/.test(String(body.paid_on ?? "")) ? body.paid_on : today.date;

      const rows = months.map((period_month) => ({
        client_account_id: accountId,
        period_month,
        status,
        amount_usd: status === "waived" ? null : amount,
        paid_on: paidOn,
        method: body.method ? String(body.method).slice(0, 80) : null,
        reference: body.reference ? String(body.reference).slice(0, 120) : null,
        notes: body.notes ? String(body.notes).slice(0, 500) : null,
        recorded_by: user.id,
      }));
      const { error: upsertError } = await admin
        .from("client_billing_payments")
        .upsert(rows, { onConflict: "client_account_id,period_month" });
      if (upsertError) throw upsertError;

      const email = status === "paid" && body.send_thanks ? await sendThanks(admin, ctx, months, today.month, user.id) : null;
      return json({ success: true, saved: months.length, email });
    }

    if (action === "send_thanks") {
      const months = parseMonths(body.months);
      if (months.length === 0) return json({ error: "Seleccione al menos un mes pagado" }, 400);
      const { data: paidRows, error: paidError } = await admin
        .from("client_billing_payments")
        .select("period_month")
        .eq("client_account_id", accountId)
        .eq("status", "paid")
        .in("period_month", months);
      if (paidError) throw paidError;
      if ((paidRows ?? []).length !== months.length) {
        return json({ error: "Solo se agradece por meses ya registrados como pagados" }, 400);
      }
      const email = await sendThanks(admin, ctx, months, today.month, user.id);
      if (!email.sent) return json({ error: `No se pudo enviar el agradecimiento: ${email.error ?? "error desconocido"}` }, 400);
      return json({ success: true, recipients: email.recipients, months });
    }

    return json({ error: "Acción no válida" }, 400);
  } catch (error) {
    console.error("[client-billing] error:", error);
    const message = error instanceof Error ? error.message : (error as { message?: string })?.message ?? String(error);
    return json({ error: `Error al procesar el cobro: ${message}` }, 500);
  }
}

if (import.meta.main) Deno.serve(handler);
