import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const smtpFrom = Deno.env.get("SMTP_FROM_EMAIL") || "no-reply@app.satescolar.com";
    const smtpFromName = Deno.env.get("SMTP_FROM_NAME") || "SatEscolar";

    if (!smtpHost || !smtpUser || !smtpPass) {
      return new Response(JSON.stringify({ error: "SMTP no configurado" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const today = new Date();
    const dayOfWeek = today.getDay();
    const dayOfMonth = today.getDate();

    // Get all delinquency configs
    const { data: configs } = await supabase.from("delinquency_config").select("*");
    if (!configs || configs.length === 0) {
      return new Response(JSON.stringify({ message: "No configs found" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let totalSent = 0;

    for (const config of configs) {
      // Check if we should send today
      let shouldSend = false;
      if (config.reminder_mode === "daily") shouldSend = true;
      else if (config.reminder_mode === "weekly") shouldSend = (config.reminder_days_of_week || []).includes(dayOfWeek);
      else if (config.reminder_mode === "monthly") shouldSend = (config.reminder_days_of_month || []).includes(dayOfMonth);

      if (!shouldSend) continue;

      // Get school info
      const { data: school } = await supabase.from("schools").select("name, phone, email, address").eq("id", config.school_id).single();
      if (!school) continue;

      // Get active school year
      const { data: activeYear } = await supabase.from("school_years").select("id, year_range").eq("school_id", config.school_id).eq("is_active", true).maybeSingle();
      if (!activeYear) continue;

      // Get overdue balances
      const { data: balances } = await supabase
        .from("student_concept_balances")
        .select("student_id, balance, plan_concept_id, payment_plan_concepts(payment_concepts(name))")
        .eq("school_id", config.school_id)
        .eq("school_year_id", activeYear.id)
        .gt("balance", 0);

      if (!balances || balances.length === 0) continue;

      // Group by student
      const studentBalances = new Map<string, any[]>();
      balances.forEach((b: any) => {
        const arr = studentBalances.get(b.student_id) || [];
        arr.push(b);
        studentBalances.set(b.student_id, arr);
      });

      for (const [studentId, bals] of studentBalances) {
        // Get student info
        const { data: student } = await supabase.from("students").select("form_data, family_id").eq("id", studentId).single();
        if (!student) continue;

        const fd = student.form_data as any || {};
        const studentName = `${fd.primer_nombre || ""} ${fd.primer_apellido || ""}`.trim();

        // Get family email
        const { data: family } = await supabase.from("families").select("id, user_id").eq("id", student.family_id).single();
        if (!family) continue;

        // Get user email from auth via profiles or user_id
        const { data: authUser } = await supabase.auth.admin.getUserById(family.user_id);
        const email = authUser?.user?.email;
        if (!email) continue;

        // Check if we already sent today
        const todayStr = today.toISOString().slice(0, 10);
        const { data: existingNotif } = await supabase
          .from("delinquency_notifications")
          .select("id")
          .eq("student_id", studentId)
          .gte("sent_at", `${todayStr}T00:00:00`)
          .maybeSingle();

        if (existingNotif) continue;

        const totalOwed = bals.reduce((s: number, b: any) => s + Number(b.balance), 0);
        const conceptsList = bals.map((b: any) => ({
          name: b.payment_plan_concepts?.payment_concepts?.name || "Concepto",
          amount: Number(b.balance),
        }));

        // Build email HTML
        const conceptsHtml = conceptsList.map((c: any) => `<tr><td style="padding:8px;border-bottom:1px solid #eee;">${c.name}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">Bs. ${c.amount.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</td></tr>`).join("");

        const html = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <div style="background:#01051e;padding:20px;text-align:center;border-radius:8px 8px 0 0;">
              <h1 style="color:#fff;margin:0;font-size:20px;">${school.name}</h1>
            </div>
            <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;">
              <p>Estimado Representante,</p>
              <p>Le informamos cordialmente que el estudiante <strong>${studentName}</strong> presenta los siguientes conceptos de pago pendientes correspondientes al año escolar <strong>${activeYear.year_range}</strong>:</p>
              <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                <thead><tr style="background:#f3f4f6;"><th style="padding:8px;text-align:left;">Concepto</th><th style="padding:8px;text-align:right;">Monto Pendiente</th></tr></thead>
                <tbody>${conceptsHtml}</tbody>
                <tfoot><tr style="background:#f3f4f6;font-weight:bold;"><td style="padding:8px;">Total Pendiente</td><td style="padding:8px;text-align:right;">Bs. ${totalOwed.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</td></tr></tfoot>
              </table>
              <p>Le invitamos amablemente a regularizar su situación administrativa a la brevedad posible.</p>
              <p>Para cualquier consulta, no dude en contactarnos:</p>
              <ul style="list-style:none;padding:0;">
                ${school.phone ? `<li>📞 ${school.phone}</li>` : ""}
                ${school.email ? `<li>📧 ${school.email}</li>` : ""}
              </ul>
              <p style="margin-top:24px;">Atentamente,<br/><strong>${school.name}</strong></p>
            </div>
            <div style="text-align:center;padding:16px;color:#6b7280;font-size:12px;">
              Este es un mensaje automático generado por SAT ESCOLAR
            </div>
          </div>
        `;

        // Send email via SMTP
        try {
          const smtpPayload = {
            from: { email: smtpFrom, name: smtpFromName },
            to: [{ email }],
            subject: `Recordatorio de pago pendiente — ${studentName}`,
            html,
          };

          // Use the same SMTP approach as send-email
          const emailUrl = `${supabaseUrl}/functions/v1/send-email`;
          const emailRes = await fetch(emailUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
            body: JSON.stringify({
              to: email,
              subject: smtpPayload.subject,
              html: smtpPayload.html,
            }),
          });

          const notifStatus = emailRes.ok ? "sent" : "failed";
          const errorMsg = emailRes.ok ? null : await emailRes.text();

          await supabase.from("delinquency_notifications").insert({
            school_id: config.school_id,
            student_id: studentId,
            family_id: family.id,
            email_sent_to: email,
            concepts_detail: conceptsList,
            total_owed_ves: totalOwed,
            status: notifStatus,
            error_message: errorMsg,
          });

          if (notifStatus === "sent") totalSent++;
        } catch (err: any) {
          await supabase.from("delinquency_notifications").insert({
            school_id: config.school_id,
            student_id: studentId,
            family_id: family.id,
            email_sent_to: email,
            concepts_detail: conceptsList,
            total_owed_ves: totalOwed,
            status: "failed",
            error_message: err.message,
          });
        }
      }
    }

    return new Response(JSON.stringify({ success: true, sent: totalSent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
