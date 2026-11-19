import { isSchoolModuleActive } from "../_shared/schoolModules.ts";
import { bearerToken, isServiceRoleToken } from "../_shared/serviceRole.ts";
import { mailer } from "../_shared/email/mailer.ts";
import { loadEmailTemplate, renderSchoolEmail, type SchoolBranding } from "../_shared/email/schoolTemplates.ts";
import { buildDelinquencyVariables, collectFamilyEmails, type DebtConcept } from "../_shared/email/delinquency.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

// deno-lint-ignore no-explicit-any
function shouldSendToday(config: any, today: Date): boolean {
  if (config.reminder_mode === "never") return false;
  if (config.reminder_mode === "weekly") {
    return ((config.reminder_days_of_week as string[]) || []).includes(WEEKDAYS[today.getDay()]);
  }
  if (config.reminder_mode === "monthly_days") {
    return ((config.reminder_days_of_month as number[]) || []).includes(today.getDate());
  }
  return config.reminder_mode === "daily";
}

/**
 * Daily cron (pg_cron → net.http_post with the service-role key). Only the system may run it.
 * Relies on the gateway verifying the JWT signature (verify_jwt = true in config.toml).
 * Each delinquent student's family gets ONE email addressed to the family account and every
 * representative with an email; the text is the school's "delinquency" template.
 */
export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!isServiceRoleToken(bearerToken(req))) {
    return json({ error: "Solo el sistema puede ejecutar los recordatorios" }, 403);
  }
  if (!mailer.isConfigured()) {
    return json({ error: "El envío de correos no está configurado en el servidor" }, 503);
  }

  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    const { data: configs, error: cfgErr } = await supabaseAdmin
      .from("delinquency_config")
      .select("*, schools(name, email, phone, logo_url)");
    if (cfgErr) throw cfgErr;

    let totalSent = 0;
    let totalErrors = 0;

    for (const config of configs || []) {
      if (!shouldSendToday(config, today)) continue;
      const schoolId = config.school_id;

      // Reminders are part of the payments module (docs/desc/19-modulos.md).
      if (!(await isSchoolModuleActive(supabaseAdmin, schoolId, "payments"))) {
        console.log(`[send-delinquency-reminders] school ${schoolId} skipped: payments module inactive`);
        continue;
      }

      const { data: activeYear } = await supabaseAdmin
        .from("school_years")
        .select("id")
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .maybeSingle();
      if (!activeYear) continue;

      // Complete balances before computing delinquents (same RPC as the UI).
      await supabaseAdmin.rpc("rebuild_student_concept_balances_for_active_year");
      const { data: delinquentRows, error: rpcErr } = await supabaseAdmin.rpc("get_delinquent_students", {
        _school_id: schoolId,
        _school_year_id: activeYear.id,
      });
      if (rpcErr) {
        console.error("get_delinquent_students error", rpcErr);
        continue;
      }

      const debts = new Map<string, { total: number; concepts: DebtConcept[] }>();
      // deno-lint-ignore no-explicit-any
      for (const row of (delinquentRows || []) as any[]) {
        debts.set(row.student_id, {
          total: Number(row.total_owed) || 0,
          // deno-lint-ignore no-explicit-any
          concepts: (row.concepts || []).map((c: any) => ({ name: c.name, balance: Number(c.balance) || 0 })),
        });
      }
      const studentIds = [...debts.keys()];
      if (studentIds.length === 0) continue;

      const { data: students } = await supabaseAdmin
        .from("students")
        .select("id, form_data, family_id")
        .in("id", studentIds);

      const { data: enrollments } = await supabaseAdmin
        .from("enrollments")
        .select("student_id, sections(name, grade_level)")
        .eq("school_id", schoolId)
        .eq("school_year_id", activeYear.id)
        .in("student_id", studentIds);
      // deno-lint-ignore no-explicit-any
      const enrollmentByStudent = new Map<string, any>((enrollments || []).map((e: any) => [e.student_id, e]));

      // deno-lint-ignore no-explicit-any
      const familyIds = [...new Set((students || []).map((s: any) => s.family_id).filter(Boolean))];
      const [{ data: families }, { data: representatives }] = await Promise.all([
        supabaseAdmin.from("families").select("id, user_id").in("id", familyIds),
        supabaseAdmin.from("representatives").select("family_id, email, form_data").in("family_id", familyIds),
      ]);

      const recipientsByFamily = new Map<string, string[]>();
      for (const family of families || []) {
        const account = family.user_id ? (await supabaseAdmin.auth.admin.getUserById(family.user_id)).data?.user?.email : null;
        // deno-lint-ignore no-explicit-any
        const reps = (representatives || []).filter((r: any) => r.family_id === family.id);
        recipientsByFamily.set(family.id, collectFamilyEmails(account ?? null, reps));
      }

      // deno-lint-ignore no-explicit-any
      const school = config.schools as any;
      const branding: SchoolBranding = {
        name: school?.name || "La Institución",
        logoUrl: school?.logo_url ?? null,
        phone: school?.phone ?? null,
        email: school?.email ?? null,
      };
      const { template } = await loadEmailTemplate(supabaseAdmin, schoolId, "delinquency");

      for (const student of students || []) {
        const debt = debts.get(student.id);
        const to = recipientsByFamily.get(student.family_id) ?? [];
        if (!debt || to.length === 0) continue;

        // At most one notice per student per day.
        const { data: existingNotif } = await supabaseAdmin
          .from("delinquency_notifications")
          .select("id")
          .eq("student_id", student.id)
          .eq("school_id", schoolId)
          .gte("sent_at", todayStr)
          .limit(1);
        if (existingNotif && existingNotif.length > 0) continue;

        // deno-lint-ignore no-explicit-any
        const fd = student.form_data as any;
        const studentName = [fd?.primer_nombre, fd?.segundo_nombre, fd?.primer_apellido, fd?.segundo_apellido]
          .filter(Boolean)
          .join(" ");
        const section = enrollmentByStudent.get(student.id)?.sections;

        const { subject, html } = await renderSchoolEmail(
          supabaseAdmin,
          schoolId,
          "delinquency",
          buildDelinquencyVariables({
            studentName,
            gradeName: section?.grade_level || "",
            sectionName: section?.name || "",
            concepts: debt.concepts,
            total: debt.total,
            schoolPhone: branding.phone,
            schoolEmail: branding.email,
          }),
          { branding, template },
        );

        const result = await mailer.send({ to, subject, html });
        if (result.sent) totalSent++;
        else totalErrors++;

        await supabaseAdmin.from("delinquency_notifications").insert({
          school_id: schoolId,
          student_id: student.id,
          family_id: student.family_id,
          email_sent_to: to.join(", "),
          total_owed_ves: debt.total,
          concepts_detail: debt.concepts,
          status: result.sent ? "sent" : "failed",
          error_message: result.sent ? null : (result.error ?? "Error desconocido"),
        });
      }
    }

    return json({ success: true, sent: totalSent, errors: totalErrors });
  } catch (error) {
    console.error("Error:", error);
    return json({ error: error instanceof Error ? error.message : "Error al procesar recordatorios" }, 500);
  }
}

if (import.meta.main) Deno.serve(handler);
