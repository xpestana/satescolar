import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mailer } from "../_shared/email/mailer.ts";
import { buildAttendanceEmail } from "../_shared/email/attendance.ts";
import { isSchoolModuleActive } from "../_shared/schoolModules.ts";

// Prevent SMTP/TLS internal errors from crashing the edge worker.
if (typeof addEventListener === "function") {
  addEventListener("unhandledrejection", (e: any) => {
    console.error("[record-attendance] unhandledrejection swallowed:", e?.reason ?? e);
    e?.preventDefault?.();
  });
  addEventListener("error", (e: any) => {
    console.error("[record-attendance] uncaught error swallowed:", e?.error ?? e?.message ?? e);
    e?.preventDefault?.();
  });
}

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

    // 1b. The school must have the attendance module active (docs/desc/19-modulos.md)
    if (!(await isSchoolModuleActive(supabase, school_id, "attendance"))) {
      return new Response(JSON.stringify({
        error: "El control de asistencias no está activo en este colegio",
        status: "module_inactive",
      }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

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

    // 5. Email notification (a failure never undoes the attendance record)
    if (notificationEmail) {
      try {
        // Get school info for email
        const { data: school } = await supabase
          .from("schools")
          .select("name, logo_url")
          .eq("id", school_id)
          .maybeSingle();

        const { subject, html } = buildAttendanceEmail({
          schoolName: school?.name || "Colegio",
          logoUrl: school?.logo_url ?? null,
          personName,
          roleLabel: rolLabel,
          dateLabel: now.toLocaleDateString("es-VE", { year: "numeric", month: "long", day: "numeric" }),
          timeLabel: now.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" }),
        });
        const result = await mailer.send({ to: [notificationEmail], subject, html });

        if (result.sent) {
          await supabase
            .from("attendance_records")
            .update({ notification_sent: true })
            .eq("entity_type", entity_type)
            .eq("entity_id", entity_id)
            .eq("attendance_date", now.toISOString().split("T")[0])
            .order("attendance_timestamp", { ascending: false })
            .limit(1);
        } else if (result.error !== "SMTP no configurado") {
          console.error("Email notification error:", result.error);
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

if (import.meta.main) Deno.serve(handler);
