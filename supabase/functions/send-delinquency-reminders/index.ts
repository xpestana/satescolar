import { buildDelinquencyEmailHtml, resolveSnippets, wrapWithEmailLayout } from "../_shared/email-templates.ts";
import { sendViaSmtp } from "../_shared/smtp-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const today = new Date();
    const dayOfWeek = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][today.getDay()];
    const dayOfMonth = today.getDate();

    // Get all schools with delinquency config
    const { data: configs, error: cfgErr } = await supabaseAdmin
      .from("delinquency_config")
      .select("*, schools(name, email, phone, address)");
    if (cfgErr) throw cfgErr;

    let totalSent = 0;
    let totalErrors = 0;

    for (const config of (configs || [])) {
      // Check if we should send today
      if (config.reminder_mode === "never") continue;
      if (config.reminder_mode === "weekly") {
        const days = (config.reminder_days_of_week as string[]) || [];
        if (!days.includes(dayOfWeek)) continue;
      }
      if (config.reminder_mode === "monthly_days") {
        const days = (config.reminder_days_of_month as number[]) || [];
        if (!days.includes(dayOfMonth)) continue;
      }
      // daily: always send

      const schoolId = config.school_id;

      // Get active school year
      const { data: activeYear } = await supabaseAdmin
        .from("school_years")
        .select("id, year_range")
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .maybeSingle();
      if (!activeYear) continue;

      // Asegurar saldos completos antes de calcular morosos.
      await supabaseAdmin.rpc("rebuild_student_concept_balances_for_active_year");

      // Obtener morosos desde el RPC autoritativo (mismo criterio que la UI).
      const { data: delinquentRows, error: rpcErr } = await supabaseAdmin.rpc("get_delinquent_students", {
        _school_id: schoolId,
        _school_year_id: activeYear.id,
      });
      if (rpcErr) {
        console.error("get_delinquent_students error", rpcErr);
        continue;
      }

      const studentDebts: Record<string, { total: number; concepts: any[] }> = {};
      for (const row of (delinquentRows || []) as any[]) {
        studentDebts[row.student_id] = {
          total: Number(row.total_owed) || 0,
          concepts: (row.concepts || []).map((c: any) => ({ name: c.name, balance: Number(c.balance) || 0 })),
        };
      }

      const studentIds = Object.keys(studentDebts);
      if (studentIds.length === 0) continue;

      // Get student families and emails
      const { data: students } = await supabaseAdmin
        .from("students")
        .select("id, form_data, family_id")
        .in("id", studentIds);

      // Get enrollments for grade info
      const { data: enrollments } = await supabaseAdmin
        .from("enrollments")
        .select("student_id, sections(name, grade_level)")
        .eq("school_id", schoolId)
        .eq("school_year_id", activeYear.id)
        .in("student_id", studentIds);
      const enrollMap: Record<string, any> = {};
      (enrollments || []).forEach((e: any) => { enrollMap[e.student_id] = e; });

      // Get family emails
      const familyIds = [...new Set((students || []).map((s: any) => s.family_id))];
      const { data: families } = await supabaseAdmin
        .from("families")
        .select("id, contact_phone")
        .in("id", familyIds);

      // Get family user emails
      const { data: familyUsers } = await supabaseAdmin
        .from("families")
        .select("id, user_id")
        .in("id", familyIds);
      const userIds = (familyUsers || []).map((f: any) => f.user_id).filter(Boolean);
      const emailMap: Record<string, string> = {};
      if (userIds.length > 0) {
        for (const fu of (familyUsers || [])) {
          if (!fu.user_id) continue;
          const { data: userData } = await supabaseAdmin.auth.admin.getUserById(fu.user_id);
          if (userData?.user?.email) emailMap[fu.id] = userData.user.email;
        }
      }

      const schoolInfo = config.schools as any;

      // Check for custom template once per school
      const { data: customTemplate } = await supabaseAdmin
        .from("email_templates")
        .select("subject, body_html, primary_color, text_color")
        .eq("school_id", schoolId)
        .eq("template_type", "delinquency")
        .eq("is_active", true)
        .maybeSingle();

      // Fetch school logo for custom template wrapper
      const { data: schoolRecord } = customTemplate
        ? await supabaseAdmin.from("schools").select("logo_url").eq("id", schoolId).maybeSingle()
        : { data: null };

      const smtpFromEmail = Deno.env.get("SMTP_FROM_EMAIL") ?? "";
      const smtpFromName = Deno.env.get("SMTP_FROM_NAME") ?? "SAT Escolar";

      for (const student of (students || [])) {
        const debt = studentDebts[student.id];
        if (!debt) continue;
        const email = emailMap[student.family_id];
        if (!email) continue;

        // Check if already sent today
        const todayStr = today.toISOString().split("T")[0];
        const { data: existingNotif } = await supabaseAdmin
          .from("delinquency_notifications")
          .select("id")
          .eq("student_id", student.id)
          .eq("school_id", schoolId)
          .gte("sent_at", todayStr)
          .limit(1);
        if (existingNotif && existingNotif.length > 0) continue;

        const fd = student.form_data as any;
        const studentName = [fd?.primer_nombre, fd?.segundo_nombre, fd?.primer_apellido, fd?.segundo_apellido].filter(Boolean).join(" ");
        const enrollment = enrollMap[student.id];
        const gradeName = enrollment?.sections?.grade_level || "";
        const sectionName = enrollment?.sections?.name || "";

        let htmlBody: string;
        let emailSubject: string;

        if (customTemplate) {
          const conceptsList = debt.concepts
            .map((c: any) => `<li>${c.name}: <strong>${c.balance.toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES</strong></li>`)
            .join("");
          const snippetData: Record<string, string> = {
            nombre_colegio: schoolInfo?.name || "La Institución",
            nombre_estudiante: studentName,
            grado_seccion: gradeName ? `${gradeName} - ${sectionName}` : "",
            conceptos_pendientes: `<ul>${conceptsList}</ul>`,
            total_adeudado: `${debt.total.toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES`,
            telefono_colegio: schoolInfo?.phone || "",
            email_colegio: schoolInfo?.email || "",
          };
          htmlBody = wrapWithEmailLayout(
            resolveSnippets(customTemplate.body_html, snippetData),
            customTemplate.primary_color,
            customTemplate.text_color,
            schoolInfo?.name || "La Institución",
            schoolRecord?.logo_url ?? null
          );
          emailSubject = resolveSnippets(customTemplate.subject, snippetData);
        } else {
          htmlBody = buildDelinquencyEmailHtml(
            schoolInfo?.name || "La Institución",
            studentName,
            gradeName,
            sectionName,
            debt.concepts,
            debt.total,
            schoolInfo?.phone,
            schoolInfo?.email
          );
          emailSubject = `Recordatorio de Pago Pendiente - ${studentName}`;
        }

        let status = "sent";
        let errorMessage = null;

        try {
          if (customTemplate && smtpFromEmail) {
            await sendViaSmtp({
              from: `${smtpFromName} <${smtpFromEmail}>`,
              to: [email],
              subject: emailSubject,
              html: htmlBody,
            });
          } else {
            const { error: sendErr } = await supabaseAdmin.functions.invoke("send-email", {
              body: {
                to: [email],
                subject: emailSubject,
                body: htmlBody,
                isHtml: true,
              },
            });
            if (sendErr) throw sendErr;
          }
          totalSent++;
        } catch (err: any) {
          status = "failed";
          errorMessage = err.message || "Error desconocido";
          totalErrors++;
        }

        // Log notification
        await supabaseAdmin.from("delinquency_notifications").insert({
          school_id: schoolId,
          student_id: student.id,
          family_id: student.family_id,
          email_sent_to: email,
          total_owed_ves: debt.total,
          concepts_detail: debt.concepts,
          status,
          error_message: errorMessage,
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent: totalSent, errors: totalErrors }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Error al procesar recordatorios" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

if (import.meta.main) Deno.serve(handler);
