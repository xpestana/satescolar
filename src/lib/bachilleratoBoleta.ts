import { supabase } from "@/integrations/supabase/client";
import {
  BachilleratoConfig, BoletaRenderData, BoletinCompletoRenderData,
  BoletinMomentoGrade, BoletinSubjectRow,
  DEFAULT_BACHILLERATO_CONFIG, generateBoletaHtml, generateBoletinCompletoHtml,
  wrapAllBoletasHtml,
} from "@/lib/bachilleratoTemplate";
import { fmtGradeNum, formatBoletaGradeValue } from "@/lib/gradeLiteral";

function proxyImageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith(".amazonaws.com")) {
      return `/img-proxy/${parsed.hostname}${parsed.pathname}`;
    }
  } catch { /* not a valid URL */ }
  return url;
}

/**
 * Loads an image as base64 for html2canvas. Uses Vite img-proxy in dev and
 * Supabase image-proxy when direct S3 fetch is blocked by CORS.
 */
async function resolveImageUrl(url: string): Promise<string> {
  if (!url) return "";
  if (url.startsWith("data:")) return url;

  const fetchAsDataUrl = async (
    fetchUrl: string,
    headers?: Record<string, string>,
  ): Promise<string> => {
    try {
      const res = await fetch(fetchUrl, headers ? { headers } : undefined);
      if (!res.ok) return "";
      const blob = await res.blob();
      return await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string) ?? "");
        reader.onerror = () => resolve("");
        reader.readAsDataURL(blob);
      });
    } catch {
      return "";
    }
  };

  let dataUrl = await fetchAsDataUrl(proxyImageUrl(url));
  if (dataUrl) return dataUrl;

  dataUrl = await fetchAsDataUrl(url);
  if (dataUrl) return dataUrl;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (supabaseUrl && supabaseKey) {
    const edgeProxy = `${supabaseUrl}/functions/v1/image-proxy?url=${encodeURIComponent(url)}`;
    dataUrl = await fetchAsDataUrl(edgeProxy, {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    });
    if (dataUrl) return dataUrl;
  }

  return "";
}

/** Inline signature/stamp images for html2canvas (same CORS fix as school logo). */
async function resolveBoletinSignatures(cfg: BachilleratoConfig): Promise<BachilleratoConfig> {
  const sigs = cfg.boletin?.signatures ?? [];
  if (sigs.length === 0) return cfg;
  const resolved = await Promise.all(
    sigs.map(async (sig) => ({
      ...sig,
      firma_url: sig.firma_url ? await resolveImageUrl(sig.firma_url) : "",
      sello_url: sig.sello_url ? await resolveImageUrl(sig.sello_url) : "",
    })),
  );
  return { ...cfg, boletin: { ...cfg.boletin!, signatures: resolved } };
}

export interface BachillerataBoletaParams {
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
  /** Boletín completo: usar notas guardadas en final_grades con momento=0 en columna Def. */
  useStoredDefinitiva?: boolean;
}

type GradeMapKey = `${string}:${number}`;

type BoletaAssignment = {
  id: string;
  subject?: { name?: string; display_order?: number; evaluation_type?: string };
};

const ASSIGNMENT_SELECT = "id, subject:subject_id(name, display_order, evaluation_type)";

function subjectGradeValue(g: { grade_value?: string; adjustment_points?: number | null }): number | null {
  const nota = parseFloat(g.grade_value ?? "");
  if (isNaN(nota)) return null;
  return nota + (g.adjustment_points ?? 0);
}

function evalTypeOf(assignments: BoletaAssignment[], assignmentId: string): string | undefined {
  return assignments.find((a) => a.id === assignmentId)?.subject?.evaluation_type;
}

function isLiteralAssignment(assignments: BoletaAssignment[], assignmentId: string): boolean {
  return evalTypeOf(assignments, assignmentId) === "literal";
}

function buildSimpleBoletaSubjects(
  validAssignments: BoletaAssignment[],
  myGrades: { assignment_id: string; grade_value?: string; adjustment_points?: number | null }[],
): { subjects: { name: string; grade: string }[]; definitiva: string } {
  const numericByAssignment: Record<string, number> = {};
  let sum = 0;
  let count = 0;

  myGrades.forEach((g) => {
    const v = subjectGradeValue(g);
    if (v === null) return;
    numericByAssignment[g.assignment_id] = v;
    if (!isLiteralAssignment(validAssignments, g.assignment_id)) {
      sum += v;
      count++;
    }
  });

  const subjects = validAssignments.map((a) => {
    const v = numericByAssignment[a.id];
    return {
      name: a.subject?.name ?? "Área",
      grade: v !== undefined ? formatBoletaGradeValue(v, a.subject?.evaluation_type) : "—",
    };
  });

  const definitiva = count > 0 ? fmtGradeNum(sum / count) : "—";
  return { subjects, definitiva };
}

function buildBoletinFromGrades(
  validAssignments: BoletaAssignment[],
  myGrades: { assignment_id: string; momento: number; grade_value?: string; adjustment_points?: number | null; absence_count?: number | null }[],
  useStoredDefinitiva: boolean,
): { subjects: BoletinSubjectRow[]; avg_m1: string; avg_m2: string; avg_m3: string; avg_student: string } {
  const myMap: Record<GradeMapKey, { nota: string; ajuste: string; def: string; inas: number }> = {};
  const def0NumericByAssignment: Record<string, number> = {};

  myGrades.forEach((g) => {
    if (g.momento === 0) {
      const val = subjectGradeValue(g);
      if (val !== null) def0NumericByAssignment[g.assignment_id] = val;
      return;
    }
    const nota = parseFloat(g.grade_value ?? "0");
    const ajuste = g.adjustment_points ?? 0;
    if (isNaN(nota)) return;
    const def = nota + ajuste;
    const evalType = evalTypeOf(validAssignments, g.assignment_id);
    myMap[`${g.assignment_id}:${g.momento}` as GradeMapKey] = {
      nota: formatBoletaGradeValue(nota, evalType),
      ajuste: ajuste !== 0 ? fmtGradeNum(ajuste) : "0",
      def: formatBoletaGradeValue(def, evalType),
      inas: g.absence_count ?? 0,
    };
  });

  const momSums: Record<number, { sum: number; count: number }> = {
    1: { sum: 0, count: 0 }, 2: { sum: 0, count: 0 }, 3: { sum: 0, count: 0 },
  };
  myGrades.forEach((g) => {
    if (g.momento < 1 || g.momento > 3) return;
    if (isLiteralAssignment(validAssignments, g.assignment_id)) return;
    const val = subjectGradeValue(g);
    if (val === null) return;
    momSums[g.momento].sum += val;
    momSums[g.momento].count += 1;
  });

  const fmtAvg = (s: { sum: number; count: number }) =>
    s.count > 0 ? fmtGradeNum(s.sum / s.count) : "—";

  const avg_m1 = fmtAvg(momSums[1]);
  const avg_m2 = fmtAvg(momSums[2]);
  const avg_m3 = fmtAvg(momSums[3]);

  let avg_student: string;
  if (useStoredDefinitiva) {
    const def0Vals = validAssignments
      .filter((a) => !isLiteralAssignment(validAssignments, a.id))
      .map((a) => def0NumericByAssignment[a.id])
      .filter((v): v is number => v !== undefined);
    avg_student =
      def0Vals.length > 0
        ? fmtGradeNum(def0Vals.reduce((a, b) => a + b, 0) / def0Vals.length)
        : "—";
  } else {
    let overallSum = 0;
    let overallCount = 0;
    [1, 2, 3].forEach((m) => {
      if (momSums[m].count > 0) {
        overallSum += momSums[m].sum / momSums[m].count;
        overallCount += 1;
      }
    });
    avg_student = overallCount > 0 ? fmtGradeNum(overallSum / overallCount) : "—";
  }

  const getNumericDef = (assignmentId: string, m: number): number | null => {
    const g = myGrades.find((x) => x.assignment_id === assignmentId && x.momento === m);
    if (!g) return null;
    const nota = parseFloat(g.grade_value ?? "0");
    if (isNaN(nota)) return null;
    return nota + (g.adjustment_points ?? 0);
  };

  const getMg = (assignmentId: string, m: number): BoletinMomentoGrade | null => {
    const entry = myMap[`${assignmentId}:${m}` as GradeMapKey];
    if (!entry) return null;
    return { nota: entry.nota, ajuste: entry.ajuste, definitiva: entry.def, inasistencias: entry.inas };
  };

  const subjects: BoletinSubjectRow[] = validAssignments.map((a, idx) => {
    const m1 = getMg(a.id, 1);
    const m2 = getMg(a.id, 2);
    const m3 = getMg(a.id, 3);
    const evalType = a.subject?.evaluation_type;
    let definitiva_final: string;
    if (useStoredDefinitiva && def0NumericByAssignment[a.id] !== undefined) {
      definitiva_final = formatBoletaGradeValue(def0NumericByAssignment[a.id], evalType);
    } else {
      const defs = [1, 2, 3]
        .map((m) => getNumericDef(a.id, m))
        .filter((v): v is number => v !== null);
      definitiva_final =
        defs.length > 0
          ? formatBoletaGradeValue(defs.reduce((s, d) => s + d, 0) / defs.length, evalType)
          : "—";
    }
    return {
      number: idx + 1,
      name: a.subject?.name ?? "Área",
      m1, m2, m3,
      definitiva_final,
    };
  });

  return { subjects, avg_m1, avg_m2, avg_m3, avg_student };
}

function rankSectionByMomento(
  allGrades: { student_id: string; momento: number; grade_value?: string; adjustment_points?: number | null }[],
  rankingMomento: number,
): { ranked: { sid: string; avg: number }[]; avg_section: string } {
  const perStudent: Record<string, { sum: number; count: number }> = {};
  allGrades
    .filter((g) => g.momento === rankingMomento)
    .forEach((g) => {
      const v = subjectGradeValue(g);
      if (v === null) return;
      if (!perStudent[g.student_id]) perStudent[g.student_id] = { sum: 0, count: 0 };
      perStudent[g.student_id].sum += v;
      perStudent[g.student_id].count += 1;
    });
  const ranked = Object.entries(perStudent)
    .map(([sid, { sum, count }]) => ({ sid, avg: sum / count }))
    .sort((a, b) => b.avg - a.avg);
  const secValues = Object.values(perStudent).map(({ sum, count }) => sum / count);
  const avg_section =
    secValues.length > 0
      ? fmtGradeNum(secValues.reduce((acc, v) => acc + v, 0) / secValues.length)
      : "—";
  return { ranked, avg_section };
}

export async function downloadBachilleratoBoleta(params: BachillerataBoletaParams): Promise<string> {
  const { schoolId, studentId, studentName, documentId,
          sectionId, sectionName, gradeLabel, gradeKey, yearId, yearRange, momento,
          useStoredDefinitiva = false } = params;

  // ── 1. Fetch template + school + planilla config in parallel ─────────────
  const [templateRes, schoolRes, planillaRes] = await Promise.all([
    supabase
      .from("boleta_templates" as any)
      .select("config, paper_width_mm, paper_height_mm, applicable_grades")
      .eq("school_id", schoolId)
      .eq("level", "bachillerato")
      .eq("is_active", true),
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

  const allTemplates = (templateRes.data ?? []) as any[];
  const tpl = allTemplates.find(
    (t) => Array.isArray(t.applicable_grades) && t.applicable_grades.includes(gradeKey)
  ) ?? allTemplates.find(
    (t) => !t.applicable_grades || t.applicable_grades.length === 0
  ) ?? null;
  const school = schoolRes.data;
  const planilla = planillaRes.data as any;

  // Build config: use best-matching template or fall back to defaults
  const cfg: BachilleratoConfig = tpl?.config
    ? { ...DEFAULT_BACHILLERATO_CONFIG, ...tpl.config,
        sections: { ...DEFAULT_BACHILLERATO_CONFIG.sections, ...(tpl.config?.sections ?? {}) },
        boletin:  { ...DEFAULT_BACHILLERATO_CONFIG.boletin,  ...(tpl.config?.boletin  ?? {}) } }
    : DEFAULT_BACHILLERATO_CONFIG;

  const paperW: number = tpl?.paper_width_mm  ?? 215.9;
  const paperH: number = tpl?.paper_height_mm ?? 279.4;
  const style  = cfg.style ?? "simple";

  const headerCfgRaw: Record<string, boolean> = (planilla?.header_config as Record<string, boolean>) ?? {};
  const rawSigs = planilla?.signature_lines;
  const signatureLines: string[] = Array.isArray(rawSigs)
    ? rawSigs
    : ["Firma del Representante", "Firma del Director(a)"];

  const show = (flag: string, fallback = true): boolean =>
    flag in headerCfgRaw ? headerCfgRaw[flag] : fallback;

  const rawLogoUrl = school?.logo_url ?? "";
  const logoUrl = rawLogoUrl ? ((await resolveImageUrl(rawLogoUrl)) || rawLogoUrl) : "";

  // ── 2. Assignments for this section + year ───────────────────────────────
  const { data: assignments } = await supabase
    .from("subject_teacher_assignments")
    .select(ASSIGNMENT_SELECT)
    .eq("school_id", schoolId)
    .eq("section_id", sectionId)
    .eq("school_year_id", yearId)
    .eq("is_suspended", false);

  const validAssignments = (assignments || [])
    .filter((a: any) => a.subject?.name)
    .sort((a: any, b: any) => (a.subject?.display_order ?? 999) - (b.subject?.display_order ?? 999));
  const assignmentIds = validAssignments.map((a: any) => a.id);

  // ── Common header data ───────────────────────────────────────────────────
  const headerCfg = {
    show_logo:             show("show_logo"),
    show_name:             show("show_name"),
    show_dea_code:         show("show_dea_code"),
    show_statistical_code: show("show_statistical_code"),
    show_address:          show("show_address"),
    show_phone:            show("show_phone"),
    show_rif:              show("show_rif"),
  };

  // ════════════════════════════════════════════════════════════════════════════
  // BOLETÍN COMPLETO (multi-momento)
  // ════════════════════════════════════════════════════════════════════════════
  if (style === "boletin_completo") {
    const cfgPdf = await resolveBoletinSignatures(cfg);
    const momentosRange = Array.from({ length: momento }, (_, i) => i + 1);
    const momentosFetch = useStoredDefinitiva ? [0, 1, 2, 3] : momentosRange;
    const visibleMomentos = useStoredDefinitiva ? [1, 2, 3] : momentosRange;
    const showDefinitivaColumn = useStoredDefinitiva;
    const rankingMomento = useStoredDefinitiva ? 0 : momento;
    const [myGradesRes, allGradesRes] = await Promise.all([
      assignmentIds.length > 0
        ? supabase.from("final_grades")
            .select("assignment_id, momento, grade_value, adjustment_points, absence_count")
            .eq("student_id", studentId).eq("school_id", schoolId)
            .in("momento", momentosFetch).in("assignment_id", assignmentIds)
        : Promise.resolve({ data: [] }),
      assignmentIds.length > 0
        ? supabase.from("final_grades")
            .select("student_id, momento, assignment_id, grade_value, adjustment_points")
            .eq("school_id", schoolId).eq("momento", rankingMomento)
            .in("assignment_id", assignmentIds)
        : Promise.resolve({ data: [] }),
    ]);

    const myGrades = myGradesRes.data || [];
    const allGrades = allGradesRes.data || [];
    const { subjects, avg_m1, avg_m2, avg_m3, avg_student } = buildBoletinFromGrades(
      validAssignments, myGrades, useStoredDefinitiva,
    );
    const { ranked, avg_section } = rankSectionByMomento(allGrades, rankingMomento);
    const positionIdx = ranked.findIndex((r) => r.sid === studentId);
    const position = positionIdx >= 0 ? positionIdx + 1 : 0;

    const boletinData: BoletinCompletoRenderData = {
      school_name:      school?.name ?? "",
      school_logo:      logoUrl,
      dea_code:         school?.dea_code ?? "",
      statistical_code: school?.statistical_code ?? "",
      address:          school?.address ?? "",
      phone:            school?.phone ?? "",
      rif:              school?.rif ?? "",
      header_cfg:       headerCfg,
      student_name:     studentName,
      document_id:      documentId ?? "",
      grade_label:      gradeLabel,
      section_name:     sectionName,
      year_range:       yearRange,
      lapso:            useStoredDefinitiva ? 0 : momento,
      mention:          cfg.boletin?.mention ?? "",
      subjects,
      avg_m1, avg_m2, avg_m3, avg_student, avg_section,
      position,
      signature_lines: [],
      visibleMomentos,
      showDefinitivaColumn,
    };

    return generateBoletinCompletoHtml(cfgPdf, boletinData, paperW, paperH);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SIMPLE (single momento — original behavior)
  // ════════════════════════════════════════════════════════════════════════════

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

  const { subjects, definitiva } = buildSimpleBoletaSubjects(validAssignments, myGrades);

  // Position (ranking uses all numeric grades)
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

  const data: BoletaRenderData = {
    school_name:      school?.name ?? "",
    school_logo:      logoUrl,
    dea_code:         school?.dea_code ?? "",
    statistical_code: school?.statistical_code ?? "",
    address:          school?.address ?? "",
    phone:            school?.phone ?? "",
    rif:              school?.rif ?? "",
    header_cfg:       headerCfg,
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
  return generateBoletaHtml(cfg, data, paperW, paperH);
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk download: all students in a section in one combined HTML window
// ─────────────────────────────────────────────────────────────────────────────

export interface BachillerataBoletaStudentParam {
  studentId:   string;
  studentName: string;
  documentId:  string | null;
}

export async function downloadAllBachilleratoBoletas(params: {
  schoolId:    string;
  sectionId:   string;
  sectionName: string;
  gradeLabel:  string;
  gradeKey:    string;
  yearId:      string;
  yearRange:   string;
  momento:     number;
  students:    BachillerataBoletaStudentParam[];
  useStoredDefinitiva?: boolean;
}): Promise<string> {
  const { schoolId, sectionId, sectionName, gradeLabel, gradeKey, yearId, yearRange, momento, students,
          useStoredDefinitiva = false } = params;
  if (students.length === 0) return "";

  // ── 1. Fetch template + school + planilla in parallel ─────────────────────
  const [templateRes, schoolRes, planillaRes] = await Promise.all([
    supabase
      .from("boleta_templates" as any)
      .select("config, paper_width_mm, paper_height_mm, applicable_grades")
      .eq("school_id", schoolId)
      .eq("level", "bachillerato")
      .eq("is_active", true),
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

  const allTemplatesAll = (templateRes.data ?? []) as any[];
  const tpl = allTemplatesAll.find(
    (t) => Array.isArray(t.applicable_grades) && t.applicable_grades.includes(gradeKey)
  ) ?? allTemplatesAll.find(
    (t) => !t.applicable_grades || t.applicable_grades.length === 0
  ) ?? null;
  const school = schoolRes.data;
  const planilla = planillaRes.data as any;

  const cfg: BachilleratoConfig = tpl?.config
    ? { ...DEFAULT_BACHILLERATO_CONFIG, ...tpl.config,
        sections: { ...DEFAULT_BACHILLERATO_CONFIG.sections, ...(tpl.config?.sections ?? {}) },
        boletin:  { ...DEFAULT_BACHILLERATO_CONFIG.boletin,  ...(tpl.config?.boletin  ?? {}) } }
    : DEFAULT_BACHILLERATO_CONFIG;

  const paperW: number = tpl?.paper_width_mm  ?? 215.9;
  const paperH: number = tpl?.paper_height_mm ?? 279.4;
  const style  = cfg.style ?? "simple";

  const rawLogoUrl = school?.logo_url ?? "";
  const logoUrl = rawLogoUrl ? ((await resolveImageUrl(rawLogoUrl)) || rawLogoUrl) : "";

  const headerCfgRaw: Record<string, boolean> = (planilla?.header_config as Record<string, boolean>) ?? {};
  const rawSigs = planilla?.signature_lines;
  const signatureLines: string[] = Array.isArray(rawSigs)
    ? rawSigs
    : ["Firma del Representante", "Firma del Director(a)"];
  const show = (flag: string, fallback = true): boolean =>
    flag in headerCfgRaw ? headerCfgRaw[flag] : fallback;
  const headerCfg = {
    show_logo:             show("show_logo"),
    show_name:             show("show_name"),
    show_dea_code:         show("show_dea_code"),
    show_statistical_code: show("show_statistical_code"),
    show_address:          show("show_address"),
    show_phone:            show("show_phone"),
    show_rif:              show("show_rif"),
  };

  // ── 2. Assignments ────────────────────────────────────────────────────────
  const { data: assignments } = await supabase
    .from("subject_teacher_assignments")
    .select(ASSIGNMENT_SELECT)
    .eq("school_id", schoolId)
    .eq("section_id", sectionId)
    .eq("school_year_id", yearId)
    .eq("is_suspended", false);

  const validAssignments = (assignments || [])
    .filter((a: any) => a.subject?.name)
    .sort((a: any, b: any) => (a.subject?.display_order ?? 999) - (b.subject?.display_order ?? 999));
  const assignmentIds = validAssignments.map((a: any) => a.id);

  // ── BOLETÍN COMPLETO (multi-momento) ─────────────────────────────────────
  if (style === "boletin_completo") {
    const cfgPdf = await resolveBoletinSignatures(cfg);
    const momentosRange = Array.from({ length: momento }, (_, i) => i + 1);
    const momentosFetch = useStoredDefinitiva ? [0, 1, 2, 3] : momentosRange;
    const visibleMomentos = useStoredDefinitiva ? [1, 2, 3] : momentosRange;
    const showDefinitivaColumn = useStoredDefinitiva;
    const rankingMomento = useStoredDefinitiva ? 0 : momento;
    const allGradesRes = assignmentIds.length > 0
      ? await supabase.from("final_grades")
          .select("student_id, assignment_id, momento, grade_value, adjustment_points, absence_count")
          .eq("school_id", schoolId)
          .in("momento", momentosFetch)
          .in("assignment_id", assignmentIds)
      : { data: [] };
    const allGrades: any[] = allGradesRes.data || [];
    const { ranked, avg_section } = rankSectionByMomento(allGrades, rankingMomento);

    const bodies: string[] = [];
    for (const student of students) {
      const myGrades = allGrades.filter((g: any) => g.student_id === student.studentId);
      const { subjects, avg_m1, avg_m2, avg_m3, avg_student } = buildBoletinFromGrades(
        validAssignments, myGrades, useStoredDefinitiva,
      );
      const positionIdx = ranked.findIndex((r) => r.sid === student.studentId);
      const position = positionIdx >= 0 ? positionIdx + 1 : 0;

      const boletinData: BoletinCompletoRenderData = {
        school_name: school?.name ?? "", school_logo: logoUrl,
        dea_code: school?.dea_code ?? "", statistical_code: school?.statistical_code ?? "",
        address: school?.address ?? "", phone: school?.phone ?? "", rif: school?.rif ?? "",
        header_cfg: headerCfg,
        student_name: student.studentName, document_id: student.documentId ?? "",
        grade_label: gradeLabel, section_name: sectionName, year_range: yearRange,
        lapso: useStoredDefinitiva ? 0 : momento,
        mention: cfg.boletin?.mention ?? "",
        subjects, avg_m1, avg_m2, avg_m3, avg_student, avg_section, position,
        signature_lines: [],
        visibleMomentos,
        showDefinitivaColumn,
      };
      bodies.push(generateBoletinCompletoHtml(cfgPdf, boletinData, paperW, paperH, { bodyOnly: true }));
    }

    return wrapAllBoletasHtml(bodies, paperW, paperH, "boletin_completo", {
      top:    cfg.boletin?.margin_top    ?? 4,
      bottom: cfg.boletin?.margin_bottom ?? 6,
      sides:  cfg.boletin?.margin_sides  ?? 12,
      sig_pin_bottom: cfg.boletin?.sig_pin_bottom ?? false,
    });
    return;
  }

  // ── SIMPLE (single momento) ───────────────────────────────────────────────
  const gradesRes = assignmentIds.length > 0
    ? await supabase.from("final_grades")
        .select("student_id, assignment_id, grade_value, adjustment_points")
        .eq("school_id", schoolId)
        .eq("momento", momento)
        .in("assignment_id", assignmentIds)
    : { data: [] };
  const allGrades: any[] = gradesRes.data || [];

  // Compute section position ranking
  const perStudent: Record<string, { sum: number; count: number }> = {};
  allGrades.forEach((g: any) => {
    const v = parseFloat(g.grade_value ?? "0") + (g.adjustment_points ?? 0);
    if (!isNaN(v)) {
      if (!perStudent[g.student_id]) perStudent[g.student_id] = { sum: 0, count: 0 };
      perStudent[g.student_id].sum += v; perStudent[g.student_id].count++;
    }
  });
  const ranked = Object.entries(perStudent)
    .map(([sid, { sum, count }]) => ({ sid, avg: sum / count }))
    .sort((a, b) => b.avg - a.avg);

  const bodies: string[] = [];
  for (const student of students) {
    const myGrades = allGrades.filter((g: any) => g.student_id === student.studentId);
    const { subjects, definitiva } = buildSimpleBoletaSubjects(validAssignments, myGrades);
    const positionIdx = ranked.findIndex((r) => r.sid === student.studentId);
    const position = positionIdx >= 0 ? positionIdx + 1 : 0;
    const data: BoletaRenderData = {
      school_name: school?.name ?? "", school_logo: logoUrl,
      dea_code: school?.dea_code ?? "", statistical_code: school?.statistical_code ?? "",
      address: school?.address ?? "", phone: school?.phone ?? "", rif: school?.rif ?? "",
      header_cfg: headerCfg,
      student_name: student.studentName, document_id: student.documentId ?? "",
      grade_label: gradeLabel, section_name: sectionName, year_range: yearRange,
      momento, subjects, definitiva, position,
      signature_lines: signatureLines,
    };
    bodies.push(generateBoletaHtml(cfg, data, paperW, paperH, { bodyOnly: true }));
  }

  return wrapAllBoletasHtml(bodies, paperW, paperH, "simple");
}

// ─────────────────────────────────────────────────────────────────────────────
// Definitiva Final: lee directamente momento=0 guardado en BD
// ─────────────────────────────────────────────────────────────────────────────

export async function downloadBachilleratoBoletaDefinitiva(
  params: Omit<BachillerataBoletaParams, "momento">,
): Promise<string> {
  const { schoolId, studentId, studentName, documentId,
          sectionId, sectionName, gradeLabel, gradeKey, yearId, yearRange } = params;

  const [templateRes, schoolRes, planillaRes] = await Promise.all([
    supabase
      .from("boleta_templates" as any)
      .select("config, paper_width_mm, paper_height_mm, applicable_grades")
      .eq("school_id", schoolId)
      .eq("level", "bachillerato")
      .eq("is_active", true),
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

  const allTemplates = (templateRes.data ?? []) as any[];
  const tpl = allTemplates.find(
    (t) => Array.isArray(t.applicable_grades) && t.applicable_grades.includes(gradeKey)
  ) ?? allTemplates.find(
    (t) => !t.applicable_grades || t.applicable_grades.length === 0
  ) ?? null;
  const school = schoolRes.data;
  const planilla = planillaRes.data as any;

  const cfg: BachilleratoConfig = tpl?.config
    ? { ...DEFAULT_BACHILLERATO_CONFIG, ...tpl.config,
        sections: { ...DEFAULT_BACHILLERATO_CONFIG.sections, ...(tpl.config?.sections ?? {}) },
        boletin:  { ...DEFAULT_BACHILLERATO_CONFIG.boletin,  ...(tpl.config?.boletin  ?? {}) } }
    : DEFAULT_BACHILLERATO_CONFIG;

  const paperW: number = tpl?.paper_width_mm  ?? 215.9;
  const paperH: number = tpl?.paper_height_mm ?? 279.4;
  const style  = cfg.style ?? "simple";

  const rawLogoUrl = school?.logo_url ?? "";
  const logoUrl = rawLogoUrl ? ((await resolveImageUrl(rawLogoUrl)) || rawLogoUrl) : "";

  const headerCfgRaw: Record<string, boolean> = (planilla?.header_config as Record<string, boolean>) ?? {};
  const rawSigs = planilla?.signature_lines;
  const signatureLines: string[] = Array.isArray(rawSigs)
    ? rawSigs
    : ["Firma del Representante", "Firma del Director(a)"];
  const show = (flag: string, fallback = true): boolean =>
    flag in headerCfgRaw ? headerCfgRaw[flag] : fallback;
  const headerCfg = {
    show_logo:             show("show_logo"),
    show_name:             show("show_name"),
    show_dea_code:         show("show_dea_code"),
    show_statistical_code: show("show_statistical_code"),
    show_address:          show("show_address"),
    show_phone:            show("show_phone"),
    show_rif:              show("show_rif"),
  };

  const { data: assignments } = await supabase
    .from("subject_teacher_assignments")
    .select(ASSIGNMENT_SELECT)
    .eq("school_id", schoolId)
    .eq("section_id", sectionId)
    .eq("school_year_id", yearId)
    .eq("is_suspended", false);

  const validAssignments = (assignments || [])
    .filter((a: any) => a.subject?.name)
    .sort((a: any, b: any) => (a.subject?.display_order ?? 999) - (b.subject?.display_order ?? 999));
  const assignmentIds = validAssignments.map((a: any) => a.id);

  if (style === "boletin_completo") {
    return downloadBachilleratoBoleta({ ...params, momento: 1, useStoredDefinitiva: true });
  }

  // SIMPLE — leer directamente momento=0 (definitiva guardada en BD)
  const [myGradesRes, allGradesRes] = await Promise.all([
    assignmentIds.length > 0
      ? supabase.from("final_grades")
          .select("assignment_id, grade_value, adjustment_points")
          .eq("student_id", studentId).eq("school_id", schoolId)
          .eq("momento", 0).in("assignment_id", assignmentIds)
      : Promise.resolve({ data: [] }),
    assignmentIds.length > 0
      ? supabase.from("final_grades")
          .select("student_id, assignment_id, grade_value, adjustment_points")
          .eq("school_id", schoolId)
          .eq("momento", 0).in("assignment_id", assignmentIds)
      : Promise.resolve({ data: [] }),
  ]);

  const myGrades = myGradesRes.data || [];
  const allGrades = allGradesRes.data || [];

  const { subjects, definitiva } = buildSimpleBoletaSubjects(validAssignments, myGrades);

  // Ranking basado en definitiva guardada (momento=0)
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

  const data: BoletaRenderData = {
    school_name: school?.name ?? "", school_logo: logoUrl,
    dea_code: school?.dea_code ?? "", statistical_code: school?.statistical_code ?? "",
    address: school?.address ?? "", phone: school?.phone ?? "", rif: school?.rif ?? "",
    header_cfg: headerCfg,
    student_name: studentName, document_id: documentId ?? "",
    grade_label: gradeLabel, section_name: sectionName, year_range: yearRange,
    momento: 1, momentoOverrideLabel: "Definitiva Final",
    subjects, definitiva, position,
    signature_lines: signatureLines,
  };

  return generateBoletaHtml(cfg, data, paperW, paperH);
}

export async function downloadAllBachilleratoBoletasDefinitiva(params: {
  schoolId:    string;
  sectionId:   string;
  sectionName: string;
  gradeLabel:  string;
  gradeKey:    string;
  yearId:      string;
  yearRange:   string;
  students:    BachillerataBoletaStudentParam[];
}): Promise<string> {
  const { schoolId, sectionId, sectionName, gradeLabel, gradeKey, yearId, yearRange, students } = params;
  if (students.length === 0) return "";

  const [templateRes, schoolRes, planillaRes] = await Promise.all([
    supabase
      .from("boleta_templates" as any)
      .select("config, paper_width_mm, paper_height_mm, applicable_grades")
      .eq("school_id", schoolId)
      .eq("level", "bachillerato")
      .eq("is_active", true),
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

  const allTemplatesAll = (templateRes.data ?? []) as any[];
  const tpl = allTemplatesAll.find(
    (t) => Array.isArray(t.applicable_grades) && t.applicable_grades.includes(gradeKey)
  ) ?? allTemplatesAll.find(
    (t) => !t.applicable_grades || t.applicable_grades.length === 0
  ) ?? null;
  const school = schoolRes.data;
  const planilla = planillaRes.data as any;

  const cfg: BachilleratoConfig = tpl?.config
    ? { ...DEFAULT_BACHILLERATO_CONFIG, ...tpl.config,
        sections: { ...DEFAULT_BACHILLERATO_CONFIG.sections, ...(tpl.config?.sections ?? {}) },
        boletin:  { ...DEFAULT_BACHILLERATO_CONFIG.boletin,  ...(tpl.config?.boletin  ?? {}) } }
    : DEFAULT_BACHILLERATO_CONFIG;

  const paperW: number = tpl?.paper_width_mm  ?? 215.9;
  const paperH: number = tpl?.paper_height_mm ?? 279.4;
  const style  = cfg.style ?? "simple";

  const rawLogoUrl = school?.logo_url ?? "";
  const logoUrl = rawLogoUrl ? ((await resolveImageUrl(rawLogoUrl)) || rawLogoUrl) : "";

  const headerCfgRaw: Record<string, boolean> = (planilla?.header_config as Record<string, boolean>) ?? {};
  const rawSigs = planilla?.signature_lines;
  const signatureLines: string[] = Array.isArray(rawSigs)
    ? rawSigs
    : ["Firma del Representante", "Firma del Director(a)"];
  const show = (flag: string, fallback = true): boolean =>
    flag in headerCfgRaw ? headerCfgRaw[flag] : fallback;
  const headerCfg = {
    show_logo:             show("show_logo"),
    show_name:             show("show_name"),
    show_dea_code:         show("show_dea_code"),
    show_statistical_code: show("show_statistical_code"),
    show_address:          show("show_address"),
    show_phone:            show("show_phone"),
    show_rif:              show("show_rif"),
  };

  const { data: assignments } = await supabase
    .from("subject_teacher_assignments")
    .select(ASSIGNMENT_SELECT)
    .eq("school_id", schoolId)
    .eq("section_id", sectionId)
    .eq("school_year_id", yearId)
    .eq("is_suspended", false);

  const validAssignments = (assignments || [])
    .filter((a: any) => a.subject?.name)
    .sort((a: any, b: any) => (a.subject?.display_order ?? 999) - (b.subject?.display_order ?? 999));
  const assignmentIds = validAssignments.map((a: any) => a.id);

  if (style === "boletin_completo") {
    return downloadAllBachilleratoBoletas({
      schoolId, sectionId, sectionName, gradeLabel, gradeKey,
      yearId, yearRange, momento: 1, students, useStoredDefinitiva: true,
    });
  }

  // SIMPLE — leer directamente momento=0 (definitiva guardada en BD)
  const gradesRes = assignmentIds.length > 0
    ? await supabase.from("final_grades")
        .select("student_id, assignment_id, grade_value, adjustment_points")
        .eq("school_id", schoolId)
        .eq("momento", 0)
        .in("assignment_id", assignmentIds)
    : { data: [] };
  const allGrades: any[] = gradesRes.data || [];

  // Ranking basado en definitiva guardada (momento=0)
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

  const bodies: string[] = [];
  for (const student of students) {
    const myGrades = allGrades.filter((g: any) => g.student_id === student.studentId);
    const { subjects, definitiva } = buildSimpleBoletaSubjects(validAssignments, myGrades);
    const positionIdx = ranked.findIndex((r) => r.sid === student.studentId);
    const position = positionIdx >= 0 ? positionIdx + 1 : 0;
    const data: BoletaRenderData = {
      school_name: school?.name ?? "", school_logo: logoUrl,
      dea_code: school?.dea_code ?? "", statistical_code: school?.statistical_code ?? "",
      address: school?.address ?? "", phone: school?.phone ?? "", rif: school?.rif ?? "",
      header_cfg: headerCfg,
      student_name: student.studentName, document_id: student.documentId ?? "",
      grade_label: gradeLabel, section_name: sectionName, year_range: yearRange,
      momento: 1, momentoOverrideLabel: "Definitiva Final",
      subjects, definitiva, position,
      signature_lines: signatureLines,
    };
    bodies.push(generateBoletaHtml(cfg, data, paperW, paperH, { bodyOnly: true }));
  }

  return wrapAllBoletasHtml(bodies, paperW, paperH, "simple");
}
