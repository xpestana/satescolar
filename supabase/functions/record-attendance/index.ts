import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();
    if (!token) {
      return new Response(JSON.stringify({ error: "Token requerido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. Find token
    const { data: tokenData, error: tokenErr } = await supabase
      .from("attendance_tokens")
      .select("*")
      .eq("token", token)
      .eq("is_active", true)
      .maybeSingle();

    if (tokenErr || !tokenData) {
      return new Response(JSON.stringify({
        error: "QR inválido",
        status: "invalid",
      }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { entity_type, entity_id, school_id, id: token_id } = tokenData;

    // 2. Anti-duplicate: only one entry per day
    const todayStr = new Date().toISOString().split("T")[0];
    const { data: recentRecord } = await supabase
      .from("attendance_records")
      .select("id, attendance_time")
      .eq("entity_type", entity_type)
      .eq("entity_id", entity_id)
      .eq("attendance_date", todayStr)
      .limit(1)
      .maybeSingle();

    // 3. Get person info
    let personName = "";
    let documentId = "";
    let notificationEmail = "";
    let rolLabel = "";

    if (entity_type === "teacher") {
      rolLabel = "Docente";
      const { data: teacher } = await supabase
        .from("teachers")
        .select("form_data, document_id, email")
        .eq("id", entity_id)
        .maybeSingle();
      if (teacher) {
        const fd = teacher.form_data as any || {};
        personName = [fd.primer_nombre, fd.segundo_nombre, fd.primer_apellido, fd.segundo_apellido]
          .filter(Boolean).join(" ");
        documentId = teacher.document_id || fd.documento || "";
        notificationEmail = teacher.email || "";
      }
    } else if (entity_type === "student") {
      rolLabel = "Estudiante";
      const { data: student } = await supabase
        .from("students")
        .select("form_data, document_id, family_id")
        .eq("id", entity_id)
        .maybeSingle();
      if (student) {
        const fd = student.form_data as any || {};
        personName = [fd.primer_nombre, fd.segundo_nombre, fd.primer_apellido, fd.segundo_apellido]
          .filter(Boolean).join(" ");
        documentId = student.document_id || fd.documento || "";
        // Get family email
        if (student.family_id) {
          const { data: family } = await supabase
            .from("families")
            .select("user_id")
            .eq("id", student.family_id)
            .maybeSingle();
          if (family?.user_id) {
            const { data: { user } } = await supabase.auth.admin.getUserById(family.user_id);
            notificationEmail = user?.email || "";
          }
        }
      }
    } else if (entity_type === "representative") {
      rolLabel = "Representante";
      const { data: rep } = await supabase
        .from("representatives")
        .select("form_data, document_id, family_id")
        .eq("id", entity_id)
        .maybeSingle();
      if (rep) {
        const fd = rep.form_data as any || {};
        personName = [fd.primer_nombre, fd.segundo_nombre, fd.primer_apellido, fd.segundo_apellido]
          .filter(Boolean).join(" ");
        documentId = rep.document_id || fd.documento || "";
        if (rep.family_id) {
          const { data: family } = await supabase
            .from("families")
            .select("user_id")
            .eq("id", rep.family_id)
            .maybeSingle();
          if (family?.user_id) {
            const { data: { user } } = await supabase.auth.admin.getUserById(family.user_id);
            notificationEmail = user?.email || "";
          }
        }
      }
    }

    if (!personName) personName = "Usuario";

    // If already registered today, reject
    if (recentRecord) {
      return new Response(JSON.stringify({
        status: "duplicate",
        message: "Ya se registró la entrada de hoy",
        personName,
        documentId,
        role: rolLabel,
        entity_type,
        date: new Date().toLocaleDateString("es-VE"),
        time: recentRecord.attendance_time?.substring(0, 5) || "",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 4. Insert attendance record
    const now = new Date();
    const { error: insertErr } = await supabase
      .from("attendance_records")
      .insert({
        school_id,
        entity_type,
        entity_id,
        token_id,
        attendance_date: now.toISOString().split("T")[0],
        attendance_time: now.toTimeString().split(" ")[0],
        attendance_timestamp: now.toISOString(),
        record_type: "qr",
        status: "present",
        notification_sent: false,
        notification_email: notificationEmail || null,
      });

    if (insertErr) {
      console.error("Insert error:", insertErr);
      return new Response(JSON.stringify({ error: "Error al registrar asistencia", status: "error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Send email notification (fire and forget)
    if (notificationEmail) {
      try {
        // Get school info for email
        const { data: school } = await supabase
          .from("schools")
          .select("name, logo_url")
          .eq("id", school_id)
          .maybeSingle();

        const dateStr = now.toLocaleDateString("es-VE", { year: "numeric", month: "long", day: "numeric" });
        const timeStr = now.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" });

        const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;">
  <div style="max-width:500px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.1);">
    <div style="background:#01051e;padding:20px;text-align:center;">
      ${school?.logo_url ? `<img src="${school.logo_url}" alt="" style="height:50px;margin-bottom:10px;">` : ""}
      <h2 style="color:#fff;margin:0;font-size:16px;">${school?.name || "Colegio"}</h2>
    </div>
    <div style="padding:24px;">
      <h3 style="color:#01051e;margin-top:0;">✅ Asistencia Registrada</h3>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#666;">Nombre:</td><td style="padding:8px 0;font-weight:bold;">${personName}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Rol:</td><td style="padding:8px 0;">${rolLabel}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Fecha:</td><td style="padding:8px 0;">${dateStr}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Hora:</td><td style="padding:8px 0;">${timeStr}</td></tr>
      </table>
    </div>
    <div style="background:#f8f8f8;padding:12px;text-align:center;font-size:11px;color:#999;">
      SAT ESCOLAR — Sistema de Asistencia y Tecnología Escolar
    </div>
  </div>
</body>
</html>`;

        const smtpHost = Deno.env.get("SMTP_HOST") ?? "";
        const smtpPort = parseInt(Deno.env.get("SMTP_PORT") ?? "587");
        const smtpUser = Deno.env.get("SMTP_USER") ?? "";
        const smtpPass = Deno.env.get("SMTP_PASS") ?? "";
        const fromEmail = Deno.env.get("SMTP_FROM_EMAIL") ?? "";
        const fromName = Deno.env.get("SMTP_FROM_NAME") ?? "SAT Escolar";

        if (smtpHost && smtpUser) {
          const client = new SMTPClient({
            connection: {
              hostname: smtpHost,
              port: smtpPort,
              tls: smtpPort === 465,
              auth: { username: smtpUser, password: smtpPass },
            },
          });

          await client.send({
            from: `${fromName} <${fromEmail}>`,
            to: notificationEmail,
            subject: `Asistencia registrada - ${personName}`,
            html,
          });
          await client.close();

          // Update notification_sent
          await supabase
            .from("attendance_records")
            .update({ notification_sent: true })
            .eq("entity_type", entity_type)
            .eq("entity_id", entity_id)
            .eq("attendance_date", now.toISOString().split("T")[0])
            .order("attendance_timestamp", { ascending: false })
            .limit(1);
        }
      } catch (emailErr) {
        console.error("Email notification error:", emailErr);
        // Don't fail the attendance record
      }
    }

    return new Response(JSON.stringify({
      status: "success",
      message: "Asistencia registrada exitosamente",
      personName,
      documentId,
      role: rolLabel,
      entity_type,
      date: now.toLocaleDateString("es-VE"),
      time: now.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" }),
      notificationEmail: notificationEmail || null,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Attendance error:", error);
    return new Response(JSON.stringify({ error: message || "Error interno", status: "error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

Deno.serve(handler);
