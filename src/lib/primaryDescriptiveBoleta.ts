import { supabase } from "@/integrations/supabase/client";
import {
  BachilleratoConfig,
  DEFAULT_BACHILLERATO_CONFIG,
  PrimaryDescriptiveRenderData,
  generatePrimaryDescriptiveHtml,
  wrapAllBoletasHtml,
} from "@/lib/bachilleratoTemplate";

function proxyImageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith(".amazonaws.com")) {
      return `/img-proxy/${parsed.hostname}${parsed.pathname}`;
    }
  } catch { /* not a valid URL, use as-is */ }
  return url;
}

async function fetchAsBase64(url: string): Promise<string> {
  if (!url) return "";
  try {
    const res = await fetch(proxyImageUrl(url));
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string) ?? "");
      reader.onerror = () => resolve("");
      reader.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
}

export interface PrimaryDescriptiveBoletaParams {
  schoolId:    string;
  studentId:   string;
  studentName: string;
  documentId:  string | null;
  sectionId:   string;
  sectionName: string;
  gradeLabel:  string;
  gradeKey:    string;
  yearId:      string;
  yearRange:   string;
  momento:     number;
}

async function fetchTemplateAndCommon(schoolId: string, gradeKey: string) {
  const [templateRes, schoolRes, planillaRes] = await Promise.all([
    supabase
      .from("boleta_templates" as any)
      .select("config, paper_width_mm, paper_height_mm, applicable_grades")
      .eq("school_id", schoolId)
      .eq("is_active", true),
    supabase
      .from("schools")
      .select("name, logo_url, address, dea_code, statistical_code, phone, rif")
      .eq("id", schoolId)
      .single(),
    supabase
      .from("planilla_general_config")
      .select("signature_lines")
      .eq("school_id", schoolId)
      .maybeSingle(),
  ]);

  const allTemplates = (templateRes.data ?? []) as any[];
  // Find best-matching template with style = "primaria_descriptivo"
  const primaryTemplates = allTemplates.filter(
    (t) => t.config?.style === "primaria_descriptivo"
  );
  const tpl =
    primaryTemplates.find(
      (t) => Array.isArray(t.applicable_grades) && t.applicable_grades.includes(gradeKey)
    ) ??
    primaryTemplates.find(
      (t) => !t.applicable_grades || t.applicable_grades.length === 0
    ) ??
    null;

  const cfg: BachilleratoConfig = tpl?.config
    ? {
        ...DEFAULT_BACHILLERATO_CONFIG,
        ...tpl.config,
        sections: { ...DEFAULT_BACHILLERATO_CONFIG.sections, ...(tpl.config?.sections ?? {}) },
        primaria: { show_footer_logo: false, footer_logo_url: "", footer_logo_position: "center", signatures: [], ...(tpl.config?.primaria ?? {}) },
      }
    : DEFAULT_BACHILLERATO_CONFIG;

  const paperW: number = tpl?.paper_width_mm ?? 215.9;
  const paperH: number = tpl?.paper_height_mm ?? 279.4;

  return { cfg, paperW, paperH, school: schoolRes.data, planilla: planillaRes.data };
}

async function fetchAssignmentsAndReports(
  schoolId: string,
  sectionId: string,
  yearId: string,
  studentId: string,
  momento: number,
) {
  const { data: assignments } = await supabase
    .from("subject_teacher_assignments" as any)
    .select("id, is_main_report, subject:subject_id(name, display_order)")
    .eq("school_id", schoolId)
    .eq("section_id", sectionId)
    .eq("school_year_id", yearId)
    .eq("is_suspended", false)
    .order("subject(display_order)" as any);

  const validAssignments = ((assignments ?? []) as any[]).filter(
    (a) => a.subject?.name
  );
  const assignmentIds = validAssignments.map((a) => a.id);

  let reports: any[] = [];
  if (assignmentIds.length > 0) {
    const { data } = await supabase
      .from("primary_final_reports" as any)
      .select("assignment_id, descriptive_report, literal, literal_numerico")
      .eq("student_id", studentId)
      .eq("momento", momento)
      .in("assignment_id", assignmentIds);
    reports = (data ?? []) as any[];
  }

  const reportMap: Record<string, string> = {};
  for (const r of reports) {
    if (r.descriptive_report?.trim()) reportMap[r.assignment_id] = r.descriptive_report;
  }

  // Separate main report from especialistas
  const mainAssignment = validAssignments.find((a) => a.is_main_report);
  const especialistaAssignments = validAssignments.filter((a) => !a.is_main_report);

  const main_report =
    mainAssignment && reportMap[mainAssignment.id]
      ? { subject_name: mainAssignment.subject.name, html: reportMap[mainAssignment.id] }
      : null;

  const especialistas = especialistaAssignments
    .filter((a) => reportMap[a.id])
    .map((a) => ({ subject_name: a.subject.name, html: reportMap[a.id] }));

  // FinalGradesTab saves literal/literal_numerico to assignmentIds[0] (not necessarily is_main_report),
  // so search all fetched records for whichever has the values set.
  const literalRecord = reports.find((r) => r.literal?.trim() || r.literal_numerico != null)
    ?? reports[0];
  const literal          = literalRecord?.literal?.trim() ?? "";
  const literal_numerico = literalRecord?.literal_numerico != null ? String(literalRecord.literal_numerico) : "";

  return { main_report, especialistas, literal, literal_numerico };
}

export async function downloadPrimaryDescriptiveBoleta(
  params: PrimaryDescriptiveBoletaParams,
): Promise<string> {
  const {
    schoolId, studentId, studentName, documentId,
    sectionId, gradeLabel, sectionName, gradeKey, yearId, yearRange, momento,
  } = params;

  const { cfg, paperW, paperH, school } = await fetchTemplateAndCommon(schoolId, gradeKey);
  const { main_report, especialistas, literal, literal_numerico } = await fetchAssignmentsAndReports(
    schoolId, sectionId, yearId, studentId, momento,
  );

  const [schoolLogoB64, footerLogoB64] = await Promise.all([
    fetchAsBase64(school?.logo_url ?? ""),
    fetchAsBase64(cfg.primaria?.footer_logo_url ?? ""),
  ]);
  if (cfg.primaria) cfg.primaria.footer_logo_url = footerLogoB64;

  const data: PrimaryDescriptiveRenderData = {
    school_name:      school?.name ?? "",
    school_logo:      schoolLogoB64,
    year_range:       yearRange,
    address:          (school as any)?.address ?? "",
    dea_code:         (school as any)?.dea_code ?? "",
    phone:            (school as any)?.phone ?? "",
    literal,
    literal_numerico,
    student_name:     studentName,
    document_id:      documentId ?? "",
    grade_label:      gradeLabel,
    section_name:     sectionName,
    momento,
    main_report,
    especialistas,
  };

  return generatePrimaryDescriptiveHtml(cfg, data, paperW, paperH);
}

export async function downloadAllPrimaryDescriptiveBoletas(params: {
  schoolId:    string;
  sectionId:   string;
  sectionName: string;
  gradeLabel:  string;
  gradeKey:    string;
  yearId:      string;
  yearRange:   string;
  momento:     number;
  students: { studentId: string; studentName: string; documentId: string | null }[];
}): Promise<string> {
  const {
    schoolId, sectionId, sectionName, gradeLabel, gradeKey,
    yearId, yearRange, momento, students,
  } = params;
  if (students.length === 0) return "";

  const { cfg, paperW, paperH, school } = await fetchTemplateAndCommon(schoolId, gradeKey);

  const [schoolLogoB64, footerLogoB64] = await Promise.all([
    fetchAsBase64(school?.logo_url ?? ""),
    fetchAsBase64(cfg.primaria?.footer_logo_url ?? ""),
  ]);
  if (cfg.primaria) cfg.primaria.footer_logo_url = footerLogoB64;

  const bodies = await Promise.all(
    students.map(async (s) => {
      const { main_report, especialistas, literal, literal_numerico } = await fetchAssignmentsAndReports(
        schoolId, sectionId, yearId, s.studentId, momento,
      );
      const data: PrimaryDescriptiveRenderData = {
        school_name:      school?.name ?? "",
        school_logo:      schoolLogoB64,
        year_range:       yearRange,
        address:          (school as any)?.address ?? "",
        dea_code:         (school as any)?.dea_code ?? "",
        phone:            (school as any)?.phone ?? "",
        literal,
        literal_numerico,
        student_name:     s.studentName,
        document_id:      s.documentId ?? "",
        grade_label:      gradeLabel,
        section_name:     sectionName,
        momento,
        main_report,
        especialistas,
      };
      return generatePrimaryDescriptiveHtml(cfg, data, paperW, paperH, { bodyOnly: true });
    }),
  );

  return wrapAllBoletasHtml(bodies, paperW, paperH, "simple");
}
