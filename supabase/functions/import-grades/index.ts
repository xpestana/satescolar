import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Prevent stray rejections from tearing down the edge worker.
if (typeof addEventListener === "function") {
  addEventListener("unhandledrejection", (e: any) => {
    console.error("[import-grades] unhandledrejection swallowed:", e?.reason ?? e);
    e?.preventDefault?.();
  });
  addEventListener("error", (e: any) => {
    console.error("[import-grades] uncaught error swallowed:", e?.error ?? e?.message ?? e);
    e?.preventDefault?.();
  });
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GradeItem {
  document_id: string;
  area_name: string;
  literal_numerico: number | null;
  literal: string;
  final_status: string | null;
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── Auth: admin only ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No autorizado" }, 401);

    const { data: { user: requestingUser }, error: authError } =
      await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !requestingUser) return json({ error: "Token inválido" }, 401);

    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUser.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRole) return json({ error: "Acceso denegado: se requiere rol de administrador" }, 403);

    // ── Body ──
    const body = await req.json();
    const schoolId: string = body?.school_id;
    const yearRangeInput: string = body?.school_year || "2024-2025";
    const items: GradeItem[] = Array.isArray(body?.items) ? body.items : [];

    if (!schoolId) return json({ error: "school_id es requerido" }, 400);

    const { data: school } = await supabaseAdmin
      .from("schools").select("id").eq("id", schoolId).maybeSingle();
    if (!school) return json({ error: "El colegio indicado no existe" }, 400);

    // ── Resolve school year (match ignoring spaces) ──
    const normalizedTarget = yearRangeInput.replace(/\s/g, "");
    const { data: years } = await supabaseAdmin
      .from("school_years").select("id, year_range").eq("school_id", schoolId);
    const yearMatch = (years ?? []).find((y) => (y.year_range || "").replace(/\s/g, "") === normalizedTarget);
    if (!yearMatch) return json({ error: `No existe el año escolar ${yearRangeInput} para este colegio` }, 400);
    const schoolYearId = yearMatch.id;

    // ── Caches ──
    const subjectByName = new Map<string, string>();
    {
      const { data: subjects } = await supabaseAdmin
        .from("school_subjects").select("id, name").eq("school_id", schoolId);
      for (const s of subjects ?? []) subjectByName.set(s.name, s.id);
    }

    const created: string[] = [];
    const skipped: string[] = [];
    const failed: string[] = [];
    const summary = { definitivasGuardadas: 0, omitidos: 0, errores: 0 };

    for (const item of items) {
      const label = `${item.document_id} (${item.area_name})`;
      try {
        if (item.literal_numerico == null || item.literal_numerico === undefined) {
          summary.omitidos++;
          skipped.push(`${label}: sin calificación`);
          continue;
        }

        // 1) Resolve student by document_id.
        const { data: studentRows } = await supabaseAdmin
          .from("students").select("id").eq("document_id", item.document_id);
        const studentIds = (studentRows ?? []).map((s) => s.id);
        if (studentIds.length === 0) {
          summary.errores++;
          failed.push(`${label}: estudiante no encontrado por cédula`);
          continue;
        }

        // 2) Find enrollment in this school + year -> section.
        const { data: enrRows } = await supabaseAdmin
          .from("enrollments")
          .select("student_id, section_id")
          .eq("school_id", schoolId)
          .eq("school_year_id", schoolYearId)
          .in("student_id", studentIds);
        const enrollment = (enrRows ?? [])[0];
        if (!enrollment) {
          summary.errores++;
          failed.push(`${label}: el estudiante no está inscrito en ${yearRangeInput}`);
          continue;
        }
        const studentId = enrollment.student_id;
        const sectionId = enrollment.section_id;

        // 3) Resolve subject (area) by exact name.
        const subjectId = subjectByName.get(item.area_name);
        if (!subjectId) {
          summary.errores++;
          failed.push(`${label}: no existe el área "${item.area_name}"`);
          continue;
        }

        // 4) Resolve the assignment the UI uses: (subject, year, school, section).
        const { data: asgs } = await supabaseAdmin
          .from("subject_teacher_assignments")
          .select("id, section_id")
          .eq("school_id", schoolId)
          .eq("subject_id", subjectId)
          .eq("school_year_id", schoolYearId);

        let assignmentId: string | null = (asgs ?? []).find((a) => a.section_id === sectionId)?.id ?? null;

        if (!assignmentId) {
          // Bridge: an assignment created without a section gets bound to this student's section.
          const nullAsg = (asgs ?? []).find((a) => a.section_id == null);
          if (nullAsg) {
            await supabaseAdmin
              .from("subject_teacher_assignments")
              .update({ section_id: sectionId })
              .eq("id", nullAsg.id);
            assignmentId = nullAsg.id;
          }
        }

        if (!assignmentId) {
          summary.errores++;
          failed.push(`${label}: no hay asignación del área en la sección del estudiante (créala en "Asignación de Áreas")`);
          continue;
        }

        // 5) Upsert the Definitiva Final (momento 0).
        const { error: upErr } = await supabaseAdmin
          .from("primary_final_reports")
          .upsert(
            {
              student_id: studentId,
              assignment_id: assignmentId,
              school_id: schoolId,
              momento: 0,
              literal: item.literal || "",
              literal_numerico: item.literal_numerico,
              final_status: item.final_status || null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "student_id,assignment_id,momento" },
          );
        if (upErr) throw new Error(upErr.message);

        summary.definitivasGuardadas++;
        created.push(`${label}: ${item.literal_numerico} (${item.literal})`);
      } catch (e) {
        summary.errores++;
        failed.push(`${label}: ${(e as Error).message}`);
      }
    }

    return json({ success: true, summary, created, skipped, failed }, 200);
  } catch (error) {
    console.error("[import-grades] unexpected error:", error);
    return json({ error: "Error interno del servidor" }, 500);
  }
}

if (import.meta.main) Deno.serve(handler);
