import { supabase } from "@/integrations/supabase/client";
import {
  BachilleratoConfig, BoletaRenderData,
  DEFAULT_BACHILLERATO_CONFIG, generateBoletaHtml,
} from "@/lib/bachilleratoTemplate";

export interface BachillerataBoletaParams {
  schoolId:    string;
  studentId:   string;
  studentName: string;
  documentId:  string | null;
  sectionId:   string;
  sectionName: string;
  gradeLabel:  string;
  yearId:      string;
  yearRange:   string;
  momento:     number;
}

export async function downloadBachilleratoBoleta(params: BachillerataBoletaParams): Promise<void> {
  const { schoolId, studentId, studentName, documentId,
          sectionId, sectionName, gradeLabel, yearId, yearRange, momento } = params;

  // ── 1. Fetch template + school + planilla config in parallel ─────────────
  const [templateRes, schoolRes, planillaRes] = await Promise.all([
    supabase
      .from("boleta_templates" as any)
      .select("config, paper_width_mm, paper_height_mm")
      .eq("school_id", schoolId)
      .eq("level", "bachillerato")
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("schools")
      .select("name, logo_url, dea_code, statistical_code, address, phone, rif")
      .eq("id", schoolId)
      .single(),
    supabase
      .from("planilla_general_config")
      .select("header_config, signature_lines")
      .eq("school_id", schoolId)
      .maybeSingle(),
  ]);

  const tpl = templateRes.data as any;
  const school = schoolRes.data;
  const planilla = planillaRes.data as any;

  // Build config: use active template or fall back to defaults
  const cfg: BachilleratoConfig = tpl?.config
    ? { ...DEFAULT_BACHILLERATO_CONFIG, ...tpl.config,
        sections: { ...DEFAULT_BACHILLERATO_CONFIG.sections, ...(tpl.config?.sections ?? {}) } }
    : DEFAULT_BACHILLERATO_CONFIG;

  const paperW: number = tpl?.paper_width_mm  ?? 215.9;
  const paperH: number = tpl?.paper_height_mm ?? 279.4;

  const headerCfgRaw: Record<string, boolean> = (planilla?.header_config as Record<string, boolean>) ?? {};
  const rawSigs = planilla?.signature_lines;
  const signatureLines: string[] = Array.isArray(rawSigs)
    ? rawSigs
    : ["Firma del Representante", "Firma del Director(a)"];

  const show = (flag: string, fallback = true): boolean =>
    flag in headerCfgRaw ? headerCfgRaw[flag] : fallback;

  // ── 2. Assignments for this section + year ───────────────────────────────
  const { data: assignments } = await supabase
    .from("subject_teacher_assignments")
    .select("id, subject:subject_id(name)")
    .eq("school_id", schoolId)
    .eq("section_id", sectionId)
    .eq("school_year_id", yearId)
    .eq("is_suspended", false);

  const validAssignments = (assignments || []).filter((a: any) => a.subject?.name);
  const assignmentIds = validAssignments.map((a: any) => a.id);

  // ── 3. Final grades: this student + all students (for position) ──────────
  const [myGradesRes, allGradesRes] = await Promise.all([
    assignmentIds.length > 0
      ? supabase.from("final_grades")
          .select("assignment_id, grade_value, adjustment_points")
          .eq("student_id", studentId).eq("school_id", schoolId)
          .eq("momento", momento).in("assignment_id", assignmentIds)
      : Promise.resolve({ data: [] }),
    assignmentIds.length > 0
      ? supabase.from("final_grades")
          .select("student_id, grade_value, adjustment_points")
          .eq("school_id", schoolId)
          .eq("momento", momento).in("assignment_id", assignmentIds)
      : Promise.resolve({ data: [] }),
  ]);

  const myGrades = myGradesRes.data || [];
  const allGrades = allGradesRes.data || [];

  // Grade map for this student
  const myMap: Record<string, string> = {};
  let mySum = 0, myCount = 0;
  myGrades.forEach((g: any) => {
    const v = parseFloat(g.grade_value ?? "0") + (g.adjustment_points ?? 0);
    if (!isNaN(v)) {
      myMap[g.assignment_id] = Number.isInteger(v) ? String(v) : v.toFixed(2);
      mySum += v; myCount++;
    }
  });

  const definitiva = myCount > 0
    ? (() => { const a = mySum / myCount; return Number.isInteger(a) ? String(a) : a.toFixed(2); })()
    : "—";

  // Position
  const perStudent: Record<string, { sum: number; count: number }> = {};
  allGrades.forEach((g: any) => {
    const v = parseFloat(g.grade_value ?? "0") + (g.adjustment_points ?? 0);
    if (!isNaN(v)) {
      if (!perStudent[g.student_id]) perStudent[g.student_id] = { sum: 0, count: 0 };
      perStudent[g.student_id].sum += v;
      perStudent[g.student_id].count++;
    }
  });
  const ranked = Object.entries(perStudent)
    .map(([sid, { sum, count }]) => ({ sid, avg: sum / count }))
    .sort((a, b) => b.avg - a.avg);
  const positionIdx = ranked.findIndex((r) => r.sid === studentId);
  const position = positionIdx >= 0 ? positionIdx + 1 : 0;

  // ── 4. Build render data ─────────────────────────────────────────────────
  const subjects = validAssignments.map((a: any) => ({
    name:  a.subject?.name ?? "Área",
    grade: myMap[a.id] ?? "—",
  }));

  const data: BoletaRenderData = {
    school_name:      school?.name ?? "",
    school_logo:      school?.logo_url ?? "",
    dea_code:         school?.dea_code ?? "",
    statistical_code: school?.statistical_code ?? "",
    address:          school?.address ?? "",
    phone:            school?.phone ?? "",
    rif:              school?.rif ?? "",
    header_cfg: {
      show_logo:             show("show_logo"),
      show_name:             show("show_name"),
      show_dea_code:         show("show_dea_code"),
      show_statistical_code: show("show_statistical_code"),
      show_address:          show("show_address"),
      show_phone:            show("show_phone"),
      show_rif:              show("show_rif"),
    },
    student_name: studentName,
    document_id:  documentId ?? "",
    grade_label:  gradeLabel,
    section_name: sectionName,
    year_range:   yearRange,
    momento,
    subjects,
    definitiva,
    position,
    signature_lines: signatureLines,
  };

  // ── 5. Open print window ─────────────────────────────────────────────────
  const html = generateBoletaHtml(cfg, data, paperW, paperH);
  const win = window.open("", "_blank", "width=820,height=760");
  if (!win) {
    alert("Por favor permite las ventanas emergentes para descargar la boleta.");
    return;
  }
  win.document.write(html);
  win.document.close();
}
