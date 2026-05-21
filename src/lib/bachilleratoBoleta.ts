import { supabase } from "@/integrations/supabase/client";

export interface BachillerataBoletaParams {
  schoolId: string;
  studentId: string;
  studentName: string;
  documentId: string | null;
  sectionId: string;
  sectionName: string;
  gradeLabel: string;
  yearId: string;
  yearRange: string;
  momento: number;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function downloadBachilleratoBoleta(params: BachillerataBoletaParams): Promise<void> {
  const { schoolId, studentId, studentName, documentId, sectionId, sectionName, gradeLabel, yearId, yearRange, momento } = params;

  // Parallel fetches: school info + planilla config
  const [schoolRes, planillaRes] = await Promise.all([
    supabase
      .from("schools")
      .select("id, name, logo_url, dea_code, statistical_code, address, phone, rif")
      .eq("id", schoolId)
      .single(),
    supabase
      .from("planilla_general_config")
      .select("header_config, footer_config, signature_lines")
      .eq("school_id", schoolId)
      .maybeSingle(),
  ]);

  const school = schoolRes.data;
  const planillaConfig = planillaRes.data;
  const headerCfg: Record<string, boolean> = (planillaConfig?.header_config as Record<string, boolean>) ?? {};
  const rawSigs = planillaConfig?.signature_lines;
  const signatureLines: string[] = Array.isArray(rawSigs)
    ? rawSigs
    : ["Firma del Representante", "Firma del Director(a)"];

  // Fetch all assignments for section + year (subjects for the boleta table)
  const { data: assignments } = await supabase
    .from("subject_teacher_assignments")
    .select("id, subject:subject_id(name)")
    .eq("school_id", schoolId)
    .eq("section_id", sectionId)
    .eq("school_year_id", yearId)
    .eq("is_suspended", false);

  const validAssignments = (assignments || []).filter((a: any) => a.subject?.name);
  const assignmentIds = validAssignments.map((a: any) => a.id);

  // Fetch final grades: this student + all students (for position)
  const [studentGradesRes, allGradesRes] = await Promise.all([
    assignmentIds.length > 0
      ? supabase
          .from("final_grades")
          .select("assignment_id, grade_value, adjustment_points")
          .eq("student_id", studentId)
          .eq("school_id", schoolId)
          .eq("momento", momento)
          .in("assignment_id", assignmentIds)
      : Promise.resolve({ data: [] }),
    assignmentIds.length > 0
      ? supabase
          .from("final_grades")
          .select("student_id, grade_value, adjustment_points")
          .eq("school_id", schoolId)
          .eq("momento", momento)
          .in("assignment_id", assignmentIds)
      : Promise.resolve({ data: [] }),
  ]);

  const studentGrades = studentGradesRes.data || [];
  const allGrades = allGradesRes.data || [];

  // Build this student's grade map (assignment_id → display string)
  const myGradeMap: Record<string, string> = {};
  let myGradeSum = 0;
  let myGradeCount = 0;
  studentGrades.forEach((g: any) => {
    const raw = parseFloat(g.grade_value ?? "0") + (g.adjustment_points ?? 0);
    if (!isNaN(raw)) {
      const display = Number.isInteger(raw) ? String(raw) : raw.toFixed(2);
      myGradeMap[g.assignment_id] = display;
      myGradeSum += raw;
      myGradeCount++;
    }
  });

  const definitiva =
    myGradeCount > 0
      ? (() => {
          const avg = myGradeSum / myGradeCount;
          return Number.isInteger(avg) ? String(avg) : avg.toFixed(2);
        })()
      : "—";

  // Calculate position: average per student, rank descending
  const perStudent: Record<string, { sum: number; count: number }> = {};
  allGrades.forEach((g: any) => {
    const raw = parseFloat(g.grade_value ?? "0") + (g.adjustment_points ?? 0);
    if (!isNaN(raw)) {
      if (!perStudent[g.student_id]) perStudent[g.student_id] = { sum: 0, count: 0 };
      perStudent[g.student_id].sum += raw;
      perStudent[g.student_id].count++;
    }
  });
  const ranked = Object.entries(perStudent)
    .map(([sid, { sum, count }]) => ({ sid, avg: sum / count }))
    .sort((a, b) => b.avg - a.avg);
  const positionIdx = ranked.findIndex((r) => r.sid === studentId);
  const position = positionIdx >= 0 ? positionIdx + 1 : 0;

  // Build grade rows HTML
  const gradeRows = validAssignments
    .map((a: any, idx: number) => {
      const subjectName = escapeHtml(a.subject?.name ?? "Área");
      const grade = myGradeMap[a.id] ?? "—";
      const isPass = grade !== "—" && parseFloat(grade) >= 10;
      const gradeColor = grade === "—" ? "#6b7280" : isPass ? "#166534" : "#dc2626";
      const bg = idx % 2 === 0 ? "#f9fafb" : "#ffffff";
      return `<tr style="background:${bg}">
        <td style="padding:6px 14px;border-bottom:1px solid #e5e7eb;font-size:12px">${subjectName}</td>
        <td style="padding:6px 14px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:600;font-size:12px;color:${gradeColor}">${grade}</td>
      </tr>`;
    })
    .join("\n");

  // Build header fields
  const show = (flag: keyof typeof headerCfg, val: string) =>
    headerCfg[flag] !== false && val ? val : "";

  const logoUrl = show("show_logo", school?.logo_url ?? "");
  const schoolName = show("show_name", school?.name ?? "");
  const deaCode = show("show_dea_code", school?.dea_code ? `Código DEA: ${school.dea_code}` : "");
  const statCode = show(
    "show_statistical_code",
    school?.statistical_code ? `Cód. Estadístico: ${school.statistical_code}` : ""
  );
  const address = show("show_address", school?.address ?? "");
  const phone = show("show_phone", school?.phone ? `Tel: ${school.phone}` : "");
  const rif = show("show_rif", school?.rif ? `RIF: ${school.rif}` : "");

  const momentoLabel = ["Primer", "Segundo", "Tercer"][momento - 1] ?? "Primer";

  const signaturesHtml = signatureLines
    .map(
      (sig: string) => `
      <div style="text-align:center;flex:1;padding:0 8px">
        <div style="border-top:1px solid #374151;width:80%;margin:0 auto;padding-top:6px;font-size:11px;color:#374151">${escapeHtml(sig)}</div>
      </div>`
    )
    .join("");

  const definitColor = myGradeCount === 0
    ? "#6b7280"
    : parseFloat(definitiva) >= 10
    ? "#166534"
    : "#dc2626";

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Boleta — ${escapeHtml(studentName)}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,Helvetica,sans-serif;background:#f1f5f9}
    @page{size:letter;margin:12mm 15mm}
    @media print{body{background:white}#controls{display:none!important}.boleta{margin:0!important;padding:0!important;border:none!important;box-shadow:none!important;max-width:none!important}}
    #controls{padding:10px 20px;background:white;border-bottom:1px solid #e5e7eb;display:flex;gap:10px;align-items:center}
    #controls button{padding:7px 18px;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500}
    #btn-print{background:#2563eb;color:white}
    #btn-close{background:#e2e8f0;color:#374151}
    .boleta{background:white;max-width:720px;margin:20px auto;padding:20px;border:1px solid #e5e7eb;box-shadow:0 2px 8px rgba(0,0,0,0.08)}
  </style>
</head>
<body>
<div id="controls">
  <button id="btn-print" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
  <button id="btn-close" onclick="window.close()">Cerrar</button>
</div>
<div class="boleta">
  <!-- Encabezado -->
  <div style="display:flex;align-items:center;gap:16px;padding-bottom:12px;border-bottom:2px solid #1e3a5f;margin-bottom:12px">
    ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="Logo" style="height:72px;width:auto;object-fit:contain">` : ""}
    <div style="flex:1;text-align:center">
      ${schoolName ? `<div style="font-size:16px;font-weight:700;color:#1e3a5f;text-transform:uppercase;letter-spacing:0.5px">${escapeHtml(schoolName)}</div>` : ""}
      ${deaCode ? `<div style="font-size:11px;color:#4b5563;margin-top:2px">${escapeHtml(deaCode)}</div>` : ""}
      ${statCode ? `<div style="font-size:11px;color:#4b5563">${escapeHtml(statCode)}</div>` : ""}
      ${address ? `<div style="font-size:11px;color:#4b5563">${escapeHtml(address)}</div>` : ""}
      ${phone ? `<div style="font-size:11px;color:#4b5563">${escapeHtml(phone)}</div>` : ""}
      ${rif ? `<div style="font-size:11px;color:#4b5563">${escapeHtml(rif)}</div>` : ""}
    </div>
  </div>

  <!-- Título -->
  <div style="text-align:center;background:#1e3a5f;color:white;padding:8px 12px;margin-bottom:14px;border-radius:4px">
    <div style="font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px">Boleta de Calificaciones</div>
    <div style="font-size:11px;margin-top:2px">Año Escolar ${escapeHtml(yearRange)} &mdash; ${momentoLabel} Momento</div>
  </div>

  <!-- Datos del Estudiante -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;background:#f8fafc;padding:10px 14px;border-radius:6px;border:1px solid #e2e8f0">
    <div>
      <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Estudiante</div>
      <div style="font-weight:600;font-size:13px;margin-top:1px">${escapeHtml(studentName)}</div>
    </div>
    ${documentId ? `<div>
      <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Cédula / Pasaporte</div>
      <div style="font-size:13px;margin-top:1px">${escapeHtml(documentId)}</div>
    </div>` : ""}
    <div>
      <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Año</div>
      <div style="font-size:13px;margin-top:1px">${escapeHtml(gradeLabel)}</div>
    </div>
    <div>
      <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Sección</div>
      <div style="font-size:13px;margin-top:1px">${escapeHtml(sectionName)}</div>
    </div>
  </div>

  <!-- Tabla de Notas -->
  ${validAssignments.length > 0 ? `
  <table style="width:100%;border-collapse:collapse;margin-bottom:14px;border:1px solid #e5e7eb;border-radius:4px;overflow:hidden">
    <thead>
      <tr style="background:#1e3a5f;color:white">
        <th style="padding:8px 14px;text-align:left;font-size:12px;font-weight:600">Área / Materia</th>
        <th style="padding:8px 14px;text-align:center;font-size:12px;font-weight:600;width:110px">Calificación</th>
      </tr>
    </thead>
    <tbody>
      ${gradeRows}
    </tbody>
  </table>
  ` : `<div style="padding:12px;background:#fef9c3;border:1px solid #fde047;border-radius:4px;font-size:12px;color:#713f12;margin-bottom:14px">No hay áreas asignadas o notas finales registradas para este momento.</div>`}

  <!-- Resumen -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:${signaturesHtml ? '24px' : '0'}">
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;text-align:center">
      <div style="font-size:10px;color:#4b5563;text-transform:uppercase;letter-spacing:0.5px">Definitiva del Momento</div>
      <div style="font-size:28px;font-weight:700;color:${definitColor};margin-top:4px">${escapeHtml(definitiva)}</div>
    </div>
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px;text-align:center">
      <div style="font-size:10px;color:#4b5563;text-transform:uppercase;letter-spacing:0.5px">Posición en la Sección</div>
      <div style="font-size:28px;font-weight:700;color:#1d4ed8;margin-top:4px">${position > 0 ? `${position}°` : "—"}</div>
    </div>
  </div>

  <!-- Firmas -->
  ${signaturesHtml ? `<div style="display:flex;gap:16px;margin-top:8px;padding-top:8px">${signaturesHtml}</div>` : ""}
</div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=820,height=760");
  if (!win) {
    alert("Por favor permite las ventanas emergentes para descargar la boleta.");
    return;
  }
  win.document.write(html);
  win.document.close();
}
