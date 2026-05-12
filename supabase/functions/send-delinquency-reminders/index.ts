
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

      // Get delinquent students (balance > 0)
      const { data: balances } = await supabaseAdmin
        .from("student_concept_balances")
        .select("student_id, balance, plan_concept_id, payment_plan_concepts(payment_concepts(name), due_day, due_month, is_recurring)")
        .eq("school_id", schoolId)
        .eq("school_year_id", activeYear.id)
        .gt("balance", 0);
      if (!balances || balances.length === 0) continue;

      // Compute due date per concept and skip those not yet overdue
      const SCHOOL_YEAR_START_MONTH = 8;
      const yrMatch = (activeYear.year_range || "").match(/(\d{4}).*?(\d{4})/);
      const startYear = yrMatch ? parseInt(yrMatch[1], 10) : today.getFullYear();
      const endYear = yrMatch ? parseInt(yrMatch[2], 10) : today.getFullYear();

      const studentDebts: Record<string, { total: number; concepts: any[] }> = {};
      for (const b of balances) {
        const ppc = (b.payment_plan_concepts as any) || {};
        const dueMonth: number | null = ppc.due_month ?? null;
        const dueDay: number | null = ppc.due_day ?? null;
        const isRecurring: boolean = !!ppc.is_recurring;

        let dueDate: Date | null = null;
        if (dueMonth) {
          const yr = dueMonth >= SCHOOL_YEAR_START_MONTH ? startYear : endYear;
          const d = dueDay ?? new Date(yr, dueMonth, 0).getDate();
          dueDate = new Date(yr, dueMonth - 1, d, 23, 59, 59);
        } else if (dueDay) {
          // Sin mes específico: usa día del mes en curso (recurrente o legacy)
          dueDate = new Date(today.getFullYear(), today.getMonth(), dueDay, 23, 59, 59);
        }
        // Sin vencimiento definido => no es moroso
        if (!dueDate) continue;
        if (today.getTime() <= dueDate.getTime()) continue;

        if (!studentDebts[b.student_id]) studentDebts[b.student_id] = { total: 0, concepts: [] };
        studentDebts[b.student_id].total += b.balance;
        studentDebts[b.student_id].concepts.push({
          name: ppc.payment_concepts?.name || "Concepto",
          balance: b.balance,
        });
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

        const conceptsList = debt.concepts.map((c: any) =>
          `<li>${c.name}: <strong>${c.balance.toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES</strong></li>`
        ).join("");

        const htmlBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333;">Recordatorio de Pago Pendiente</h2>
            <p>Estimado(a) representante,</p>
            <p>Le informamos cordialmente que el/la estudiante <strong>${studentName}</strong>${gradeName ? ` (${gradeName} - ${sectionName})` : ""} presenta un saldo pendiente en nuestra institución.</p>
            <h3 style="color: #555;">Conceptos pendientes:</h3>
            <ul>${conceptsList}</ul>
            <p style="font-size: 18px; color: #c0392b;"><strong>Total pendiente: ${debt.total.toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES</strong></p>
            <p>Le invitamos amablemente a regularizar su situación a la brevedad posible. Si ya realizó el pago, le agradecemos nos haga llegar el comprobante correspondiente.</p>
            <p>Para cualquier consulta, puede comunicarse con nosotros:</p>
            <ul>
              ${schoolInfo?.phone ? `<li>Teléfono: ${schoolInfo.phone}</li>` : ""}
              ${schoolInfo?.email ? `<li>Email: ${schoolInfo.email}</li>` : ""}
            </ul>
            <p>Atentamente,<br/><strong>${schoolInfo?.name || "La Institución"}</strong></p>
            <hr style="border: none; border-top: 1px solid #eee; margin-top: 30px;"/>
            <p style="font-size: 11px; color: #999;">Este es un mensaje automático generado por el sistema de gestión escolar.</p>
          </div>
        `;

        let status = "sent";
        let errorMessage = null;

        try {
          const { error: sendErr } = await supabaseAdmin.functions.invoke("send-email", {
            body: {
              to: [email],
              subject: `Recordatorio de Pago Pendiente - ${studentName}`,
              body: htmlBody,
              isHtml: true,
            },
          });
          if (sendErr) throw sendErr;
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
