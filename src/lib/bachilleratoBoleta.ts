import { supabase } from "@/integrations/supabase/client";
import {
  BachilleratoConfig, BoletaRenderData, BoletinCompletoRenderData,
  BoletinMomentoGrade, BoletinSubjectRow,
  DEFAULT_BACHILLERATO_CONFIG, generateBoletaHtml, generateBoletinCompletoHtml,
  wrapAllBoletasHtml,
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

export async function downloadBachilleratoBoleta(params: BachillerataBoletaParams): Promise<string> {
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

  // ── 2. Assignments for this section + year ───────────────────────────────
  const { data: assignments } = await supabase
    .from("subject_teacher_assignments")
    .select("id, subject:subject_id(name, display_order)")
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
    const [myGradesRes, allGradesRes] = await Promise.all([
      assignmentIds.length > 0
        ? supabase.from("final_grades")
            .select("assignment_id, momento, grade_value, adjustment_points, absence_count")
            .eq("student_id", studentId).eq("school_id", schoolId)
            .in("momento", [1, 2, 3]).in("assignment_id", assignmentIds)
        : Promise.resolve({ data: [] }),
      assignmentIds.length > 0
        ? supabase.from("final_grades")
            .select("student_id, momento, assignment_id, grade_value, adjustment_points")
            .eq("school_id", schoolId).eq("momento", momento)
            .in("assignment_id", assignmentIds)
        : Promise.resolve({ data: [] }),
    ]);

    const myGrades = myGradesRes.data || [];
    const allGrades = allGradesRes.data || [];

    // Build per-assignment per-momento grade map for this student
    type GKey = `${string}:${number}`;
    const myMap: Record<GKey, { nota: string; ajuste: string; def: string; inas: number }> = {};
    myGrades.forEach((g: any) => {
      const nota = parseFloat(g.grade_value ?? "0");
      const ajuste = g.adjustment_points ?? 0;
      const def = nota + ajuste;
      const fmtNum = (n: number) => Number.isInteger(n) ? String(n) : n.toFixed(2);
      myMap[`${g.assignment_id}:${g.momento}` as GKey] = {
        nota:   isNaN(nota) ? "" : fmtNum(nota),
        ajuste: ajuste !== 0 ? fmtNum(ajuste) : "0",
        def:    isNaN(nota) ? "" : fmtNum(def),
        inas:   g.absence_count ?? 0,
      };
    });

    // Per-momento averages for this student
    const momSums: Record<number, { sum: number; count: number }> = { 1: { sum:0, count:0 }, 2: { sum:0, count:0 }, 3: { sum:0, count:0 } };
    myGrades.forEach((g: any) => {
      const nota = parseFloat(g.grade_value ?? "0");
      const ajuste = g.adjustment_points ?? 0;
      const val = nota + ajuste;
      if (!isNaN(val) && g.momento >= 1 && g.momento <= 3) {
        momSums[g.momento].sum   += val;
        momSums[g.momento].count += 1;
      }
    });
    const fmtAvg = (s: { sum: number; count: number }) =>
      s.count > 0 ? (() => { const a = s.sum / s.count; return Number.isInteger(a) ? String(a) : a.toFixed(2); })() : "—";
    const avg_m1 = fmtAvg(momSums[1]);
    const avg_m2 = fmtAvg(momSums[2]);
    const avg_m3 = fmtAvg(momSums[3]);

    // Student overall average (momentos with data)
    let overallSum = 0, overallCount = 0;
    [1, 2, 3].forEach((m) => { if (momSums[m].count > 0) { const a = momSums[m].sum / momSums[m].count; overallSum += a; overallCount++; } });
    const avg_student = overallCount > 0
      ? (() => { const a = overallSum / overallCount; return Number.isInteger(a) ? String(a) : a.toFixed(2); })()
      : "—";

    // Section average for the current momento
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
    const positionIdx = ranked.findIndex((r) => r.sid === studentId);
    const position = positionIdx >= 0 ? positionIdx + 1 : 0;

    const secValues = Object.values(perStudent).map(({ sum, count }) => sum / count);
    const avg_section = secValues.length > 0
      ? (() => { const a = secValues.reduce((acc, v) => acc + v, 0) / secValues.length; return Number.isInteger(a) ? String(a) : a.toFixed(2); })()
      : "—";

    // Build subject rows
    const getMg = (assignmentId: string, m: number): BoletinMomentoGrade | null => {
      const entry = myMap[`${assignmentId}:${m}` as GKey];
      if (!entry || entry.nota === "") return null;
      return { nota: entry.nota, ajuste: entry.ajuste, definitiva: entry.def, inasistencias: entry.inas };
    };

    const subjects: BoletinSubjectRow[] = validAssignments.map((a: any, idx: number) => {
      const m1 = getMg(a.id, 1);
      const m2 = getMg(a.id, 2);
      const m3 = getMg(a.id, 3);
      const defs = [m1, m2, m3].filter(Boolean).map((mg) => parseFloat(mg!.definitiva));
      const defAvg = defs.length > 0
        ? (() => { const v = defs.reduce((s, d) => s + d, 0) / defs.length; return Number.isInteger(v) ? String(v) : v.toFixed(2); })()
        : "—";
      return { number: idx + 1, name: a.subject?.name ?? "Área", m1, m2, m3, definitiva_final: defAvg };
    });

    const boletinData: BoletinCompletoRenderData = {
      school_name:      school?.name ?? "",
      school_logo:      school?.logo_url ?? "",
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
      lapso:            momento,
      mention:          cfg.boletin?.mention ?? "",
      subjects,
      avg_m1, avg_m2, avg_m3, avg_student, avg_section,
      position,
      signature_lines: [],
    };

    return generateBoletinCompletoHtml(cfg, boletinData, paperW, paperH);
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
  yearId:      string;
  yearRange:   string;
  momento:     number;
  students:    BachillerataBoletaStudentParam[];
}): Promise<string> {
  const { schoolId, sectionId, sectionName, gradeLabel, yearId, yearRange, momento, students } = params;
  if (students.length === 0) return "";

  // ── 1. Fetch template + school + planilla in parallel ─────────────────────
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
    .select("id, subject:subject_id(name, display_order)")
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
    const allGradesRes = assignmentIds.length > 0
      ? await supabase.from("final_grades")
          .select("student_id, assignment_id, momento, grade_value, adjustment_points, absence_count")
          .eq("school_id", schoolId)
          .in("momento", [1, 2, 3])
          .in("assignment_id", assignmentIds)
      : { data: [] };
    const allGrades: any[] = allGradesRes.data || [];

    // Section avg for current momento (for position ranking)
    const perStudentCur: Record<string, { sum: number; count: number }> = {};
    allGrades.filter((g: any) => g.momento === momento).forEach((g: any) => {
      const v = parseFloat(g.grade_value ?? "0") + (g.adjustment_points ?? 0);
      if (!isNaN(v)) {
        if (!perStudentCur[g.student_id]) perStudentCur[g.student_id] = { sum: 0, count: 0 };
        perStudentCur[g.student_id].sum += v; perStudentCur[g.student_id].count++;
      }
    });
    const ranked = Object.entries(perStudentCur)
      .map(([sid, { sum, count }]) => ({ sid, avg: sum / count }))
      .sort((a, b) => b.avg - a.avg);
    const secValues = Object.values(perStudentCur).map(({ sum, count }) => sum / count);
    const avg_section = secValues.length > 0
      ? (() => { const a = secValues.reduce((acc, v) => acc + v, 0) / secValues.length; return Number.isInteger(a) ? String(a) : a.toFixed(2); })()
      : "—";

    type GKey = `${string}:${number}`;
    const fmtNum = (n: number) => Number.isInteger(n) ? String(n) : n.toFixed(2);

    const bodies: string[] = [];
    for (const student of students) {
      const myGrades = allGrades.filter((g: any) => g.student_id === student.studentId);

      const myMap: Record<GKey, { nota: string; ajuste: string; def: string; inas: number }> = {};
      myGrades.forEach((g: any) => {
        const nota = parseFloat(g.grade_value ?? "0");
        const ajuste = g.adjustment_points ?? 0;
        const def = nota + ajuste;
        myMap[`${g.assignment_id}:${g.momento}` as GKey] = {
          nota:   isNaN(nota) ? "" : fmtNum(nota),
          ajuste: ajuste !== 0 ? fmtNum(ajuste) : "0",
          def:    isNaN(nota) ? "" : fmtNum(def),
          inas:   g.absence_count ?? 0,
        };
      });

      const momSums: Record<number, { sum: number; count: number }> = { 1: { sum:0, count:0 }, 2: { sum:0, count:0 }, 3: { sum:0, count:0 } };
      myGrades.forEach((g: any) => {
        const nota = parseFloat(g.grade_value ?? "0");
        const ajuste = g.adjustment_points ?? 0;
        const val = nota + ajuste;
        if (!isNaN(val) && g.momento >= 1 && g.momento <= 3) {
          momSums[g.momento].sum += val; momSums[g.momento].count++;
        }
      });
      const fmtAvg = (s: { sum: number; count: number }) =>
        s.count > 0 ? (() => { const a = s.sum / s.count; return Number.isInteger(a) ? String(a) : a.toFixed(2); })() : "—";
      const avg_m1 = fmtAvg(momSums[1]);
      const avg_m2 = fmtAvg(momSums[2]);
      const avg_m3 = fmtAvg(momSums[3]);

      let overallSum = 0, overallCount = 0;
      [1, 2, 3].forEach((m) => { if (momSums[m].count > 0) { overallSum += momSums[m].sum / momSums[m].count; overallCount++; } });
      const avg_student = overallCount > 0
        ? (() => { const a = overallSum / overallCount; return Number.isInteger(a) ? String(a) : a.toFixed(2); })()
        : "—";

      const positionIdx = ranked.findIndex((r) => r.sid === student.studentId);
      const position = positionIdx >= 0 ? positionIdx + 1 : 0;

      const getMg = (assignmentId: string, m: number): BoletinMomentoGrade | null => {
        const entry = myMap[`${assignmentId}:${m}` as GKey];
        if (!entry || entry.nota === "") return null;
        return { nota: entry.nota, ajuste: entry.ajuste, definitiva: entry.def, inasistencias: entry.inas };
      };

      const subjects: BoletinSubjectRow[] = validAssignments.map((a: any, idx: number) => {
        const m1 = getMg(a.id, 1);
        const m2 = getMg(a.id, 2);
        const m3 = getMg(a.id, 3);
        const defs = [m1, m2, m3].filter(Boolean).map((mg) => parseFloat(mg!.definitiva));
        const defAvg = defs.length > 0
          ? (() => { const v = defs.reduce((s, d) => s + d, 0) / defs.length; return Number.isInteger(v) ? String(v) : v.toFixed(2); })()
          : "—";
        return { number: idx + 1, name: a.subject?.name ?? "Área", m1, m2, m3, definitiva_final: defAvg };
      });

      const boletinData: BoletinCompletoRenderData = {
        school_name: school?.name ?? "", school_logo: school?.logo_url ?? "",
        dea_code: school?.dea_code ?? "", statistical_code: school?.statistical_code ?? "",
        address: school?.address ?? "", phone: school?.phone ?? "", rif: school?.rif ?? "",
        header_cfg: headerCfg,
        student_name: student.studentName, document_id: student.documentId ?? "",
        grade_label: gradeLabel, section_name: sectionName, year_range: yearRange,
        lapso: momento, mention: cfg.boletin?.mention ?? "",
        subjects, avg_m1, avg_m2, avg_m3, avg_student, avg_section, position,
        signature_lines: [],
      };
      bodies.push(generateBoletinCompletoHtml(cfg, boletinData, paperW, paperH, { bodyOnly: true }));
    }

    return wrapAllBoletasHtml(bodies, paperW, paperH, "boletin_completo");
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
    const positionIdx = ranked.findIndex((r) => r.sid === student.studentId);
    const position = positionIdx >= 0 ? positionIdx + 1 : 0;
    const subjects = validAssignments.map((a: any) => ({
      name:  a.subject?.name ?? "Área",
      grade: myMap[a.id] ?? "—",
    }));
    const data: BoletaRenderData = {
      school_name: school?.name ?? "", school_logo: school?.logo_url ?? "",
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
