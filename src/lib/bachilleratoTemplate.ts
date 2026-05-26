// ─── Types ────────────────────────────────────────────────────────────────────

export interface BachilleratoConfig {
  style?: "simple" | "boletin_completo";
  sections: {
    header:      boolean;
    title:       boolean;
    student_info: boolean;
    grades_table: boolean;
    summary:     boolean;
    signatures:  boolean;
  };
  header: {
    accent_color:     string;
    name_font_size:   number;
    sub_font_size:    number;
  };
  title: {
    text:       string;
    bg_color:   string;
    text_color: string;
    font_size:  number;
  };
  student: {
    show_document: boolean;
    show_section:  boolean;
    bg_color:      string;
    border_color:  string;
  };
  table: {
    header_bg:      string;
    header_text:    string;
    alt_row:        boolean;
    alt_row_color:  string;
    pass_color:     boolean;
  };
  summary: {
    show_definitiva:   boolean;
    show_position:     boolean;
    definitiva_bg:     string;
    definitiva_border: string;
    position_bg:       string;
    position_border:   string;
  };
  boletin?: {
    mention:           string;
    table_header_bg:   string;
    table_header_text: string;
    signatures:        BoletinSignature[];
  };
}

export interface BoletinSignature {
  nombre:    string;
  cedula:    string;
  cargo:     string;
  firma_url: string;
  sello_url: string;
}

// ─── Boletín Completo types ────────────────────────────────────────────────────

export interface BoletinMomentoGrade {
  nota:          string;
  ajuste:        string;
  definitiva:    string;
  inasistencias: number;
}

export interface BoletinSubjectRow {
  number:          number;
  name:            string;
  m1:              BoletinMomentoGrade | null;
  m2:              BoletinMomentoGrade | null;
  m3:              BoletinMomentoGrade | null;
  definitiva_final: string;
}

export interface BoletinCompletoRenderData {
  school_name:      string;
  school_logo:      string;
  dea_code:         string;
  statistical_code: string;
  address:          string;
  phone:            string;
  rif:              string;
  header_cfg: {
    show_logo:             boolean;
    show_name:             boolean;
    show_dea_code:         boolean;
    show_statistical_code: boolean;
    show_address:          boolean;
    show_phone:            boolean;
    show_rif:              boolean;
  };
  student_name: string;
  document_id:  string;
  grade_label:  string;
  section_name: string;
  year_range:   string;
  lapso:        number;
  mention:      string;
  subjects:     BoletinSubjectRow[];
  avg_m1:       string;
  avg_m2:       string;
  avg_m3:       string;
  avg_student:  string;
  avg_section:  string;
  position:     number;
  signature_lines: string[];
}

export interface BachilleratoTemplate {
  id:              string;
  school_id:       string;
  name:            string;
  description:     string | null;
  level:           string;
  paper_width_mm:  number;
  paper_height_mm: number;
  config:          BachilleratoConfig;
  is_active:       boolean;
  created_at:      string;
}

export interface BoletaRenderData {
  // School header
  school_name:        string;
  school_logo:        string;
  dea_code:           string;
  statistical_code:   string;
  address:            string;
  phone:              string;
  rif:                string;
  header_cfg: {
    show_logo:               boolean;
    show_name:               boolean;
    show_dea_code:           boolean;
    show_statistical_code:   boolean;
    show_address:            boolean;
    show_phone:              boolean;
    show_rif:                boolean;
  };
  // Student
  student_name:  string;
  document_id:   string;
  grade_label:   string;
  section_name:  string;
  year_range:    string;
  momento:       number;
  // Grades
  subjects:      Array<{ name: string; grade: string }>;
  definitiva:    string;
  position:      number;
  // Footer
  signature_lines: string[];
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_BACHILLERATO_CONFIG: BachilleratoConfig = {
  style: "simple",
  sections: {
    header:       true,
    title:        true,
    student_info: true,
    grades_table: true,
    summary:      true,
    signatures:   true,
  },
  header: {
    accent_color:   "#1e3a5f",
    name_font_size: 16,
    sub_font_size:  11,
  },
  title: {
    text:       "BOLETA DE CALIFICACIONES",
    bg_color:   "#1e3a5f",
    text_color: "#ffffff",
    font_size:  14,
  },
  student: {
    show_document: true,
    show_section:  true,
    bg_color:      "#f8fafc",
    border_color:  "#e2e8f0",
  },
  table: {
    header_bg:     "#1e3a5f",
    header_text:   "#ffffff",
    alt_row:       true,
    alt_row_color: "#f9fafb",
    pass_color:    true,
  },
  summary: {
    show_definitiva:   true,
    show_position:     true,
    definitiva_bg:     "#f0fdf4",
    definitiva_border: "#bbf7d0",
    position_bg:       "#eff6ff",
    position_border:   "#bfdbfe",
  },
  boletin: {
    mention:           "",
    table_header_bg:   "#000000",
    table_header_text: "#ffffff",
    signatures:        [],
  },
};

// Sample data used while editing (preview)
export const SAMPLE_RENDER_DATA: BoletaRenderData = {
  school_name:      "UNIDAD EDUCATIVA EJEMPLO",
  school_logo:      "",
  dea_code:         "CO-12345",
  statistical_code: "ES-67890",
  address:          "Av. Principal, Edificio Centro, Caracas",
  phone:            "0212-123.4567",
  rif:              "J-12345678-9",
  header_cfg: {
    show_logo: true, show_name: true, show_dea_code: true,
    show_statistical_code: true, show_address: true,
    show_phone: true, show_rif: true,
  },
  student_name: "PÉREZ GONZÁLEZ, Ana Valentina",
  document_id:  "V-12.345.678",
  grade_label:  "3er Año",
  section_name: "A",
  year_range:   "2025-2026",
  momento:      1,
  subjects: [
    { name: "Matemáticas",          grade: "18" },
    { name: "Lengua y Literatura",  grade: "15" },
    { name: "Biología",             grade: "14" },
    { name: "Química",              grade: "12" },
    { name: "Historia Universal",   grade: "17" },
    { name: "Geografía",            grade: "16" },
    { name: "Educación Física",     grade: "19" },
  ],
  definitiva:      "15.86",
  position:        3,
  signature_lines: ["Firma del Representante", "Firma del Director(a)"],
};

const sampleM1 = (n: string, a: string, i: number): BoletinMomentoGrade => {
  const nota = parseFloat(n); const ajuste = parseFloat(a);
  const def = nota + ajuste;
  return { nota: n, ajuste: a || "0", definitiva: Number.isInteger(def) ? String(def) : def.toFixed(2), inasistencias: i };
};

export const SAMPLE_BOLETIN_COMPLETO_DATA: BoletinCompletoRenderData = {
  school_name:      "UE COLEGIO EJEMPLO",
  school_logo:      "",
  dea_code:         "CO-12345",
  statistical_code: "ES-67890",
  address:          "Av. Las Americas, Sector Santa Barbara Este",
  phone:            "274-2667989",
  rif:              "J-12345678-9",
  header_cfg: {
    show_logo: true, show_name: true, show_dea_code: true,
    show_statistical_code: true, show_address: true,
    show_phone: true, show_rif: false,
  },
  student_name: "SALAZAR CHAVEZ, Ariana Victoria",
  document_id:  "V-34856362",
  grade_label:  "1er Año",
  section_name: "A",
  year_range:   "2025-2026",
  lapso:        2,
  mention:      "CIENCIAS Y TECNOLOGÍA",
  subjects: [
    { number: 1, name: "LENGUA Y LITERATURA",   m1: sampleM1("19","0",0), m2: sampleM1("19","0",4), m3: null, definitiva_final: "19" },
    { number: 2, name: "IDIOMAS",               m1: sampleM1("20","0",0), m2: sampleM1("19","0",0), m3: null, definitiva_final: "19.50" },
    { number: 3, name: "MATEMÁTICAS",           m1: sampleM1("18","1",0), m2: sampleM1("19","0",0), m3: null, definitiva_final: "19" },
    { number: 4, name: "EDUCACIÓN FÍSICA",      m1: sampleM1("20","0",0), m2: sampleM1("20","0",0), m3: null, definitiva_final: "20" },
    { number: 5, name: "BIOLOGÍA AMB. Y TEC.",  m1: sampleM1("20","0",0), m2: sampleM1("20","0",0), m3: null, definitiva_final: "20" },
    { number: 6, name: "FÍSICA",               m1: sampleM1("20","0",0), m2: sampleM1("17","0",0), m3: null, definitiva_final: "18.50" },
    { number: 7, name: "QUÍMICA",              m1: sampleM1("18","1",0), m2: sampleM1("18","0",0), m3: null, definitiva_final: "18.50" },
  ],
  avg_m1:      "19.56",
  avg_m2:      "18.89",
  avg_m3:      "0",
  avg_student: "19.44",
  avg_section: "16.88",
  position:    3,
  signature_lines: [],
};

// ─── HTML generator ────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function show(flag: boolean, val: string): string {
  return flag && val ? val : "";
}

export function generateBoletaHtml(
  cfg: BachilleratoConfig,
  data: BoletaRenderData,
  paperWidthMm: number,
  paperHeightMm: number,
  opts?: { bodyOnly?: boolean },
): string {
  const momentoLabel = ["Primer", "Segundo", "Tercer"][data.momento - 1] ?? "Primer";
  const hc = data.header_cfg;

  // ── Header ────────────────────────────────────────────────────────────────
  const logoHtml = hc.show_logo && data.school_logo
    ? `<img src="${esc(data.school_logo)}" alt="Logo" style="height:72px;width:auto;object-fit:contain;flex-shrink:0">`
    : "";
  const nameHtml = hc.show_name && data.school_name
    ? `<div style="font-size:${cfg.header.name_font_size}pt;font-weight:700;color:${cfg.header.accent_color};text-transform:uppercase;letter-spacing:0.5px">${esc(data.school_name)}</div>`
    : "";
  const deaHtml = hc.show_dea_code && data.dea_code
    ? `<div style="font-size:${cfg.header.sub_font_size}pt;color:#4b5563;margin-top:2px">Código DEA: ${esc(data.dea_code)}</div>`
    : "";
  const statHtml = hc.show_statistical_code && data.statistical_code
    ? `<div style="font-size:${cfg.header.sub_font_size}pt;color:#4b5563">Cód. Estadístico: ${esc(data.statistical_code)}</div>`
    : "";
  const addrHtml = hc.show_address && data.address
    ? `<div style="font-size:${cfg.header.sub_font_size}pt;color:#4b5563">${esc(data.address)}</div>`
    : "";
  const phoneHtml = hc.show_phone && data.phone
    ? `<div style="font-size:${cfg.header.sub_font_size}pt;color:#4b5563">Tel: ${esc(data.phone)}</div>`
    : "";
  const rifHtml = hc.show_rif && data.rif
    ? `<div style="font-size:${cfg.header.sub_font_size}pt;color:#4b5563">RIF: ${esc(data.rif)}</div>`
    : "";

  const headerHtml = cfg.sections.header ? `
  <div style="display:flex;align-items:center;gap:16px;padding-bottom:12px;border-bottom:2px solid ${cfg.header.accent_color};margin-bottom:12px">
    ${logoHtml}
    <div style="flex:1;text-align:center">
      ${nameHtml}${deaHtml}${statHtml}${addrHtml}${phoneHtml}${rifHtml}
    </div>
  </div>` : "";

  // ── Title ─────────────────────────────────────────────────────────────────
  const titleHtml = cfg.sections.title ? `
  <div style="text-align:center;background:${cfg.title.bg_color};color:${cfg.title.text_color};padding:8px 12px;margin-bottom:14px;border-radius:4px">
    <div style="font-size:${cfg.title.font_size}pt;font-weight:700;text-transform:uppercase;letter-spacing:0.5px">${esc(cfg.title.text)}</div>
    <div style="font-size:10pt;margin-top:2px">Año Escolar ${esc(data.year_range)} &mdash; ${momentoLabel} Momento</div>
  </div>` : "";

  // ── Student info ──────────────────────────────────────────────────────────
  const studentCols = [
    `<div><div style="font-size:8pt;color:#6b7280;text-transform:uppercase;letter-spacing:0.4px">Estudiante</div><div style="font-weight:600;font-size:11pt;margin-top:1px">${esc(data.student_name)}</div></div>`,
    cfg.student.show_document && data.document_id
      ? `<div><div style="font-size:8pt;color:#6b7280;text-transform:uppercase;letter-spacing:0.4px">Cédula / Pasaporte</div><div style="font-size:11pt;margin-top:1px">${esc(data.document_id)}</div></div>`
      : "",
    `<div><div style="font-size:8pt;color:#6b7280;text-transform:uppercase;letter-spacing:0.4px">Año</div><div style="font-size:11pt;margin-top:1px">${esc(data.grade_label)}</div></div>`,
    cfg.student.show_section
      ? `<div><div style="font-size:8pt;color:#6b7280;text-transform:uppercase;letter-spacing:0.4px">Sección</div><div style="font-size:11pt;margin-top:1px">${esc(data.section_name)}</div></div>`
      : "",
  ].filter(Boolean).join("");

  const studentHtml = cfg.sections.student_info ? `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;background:${cfg.student.bg_color};padding:10px 14px;border-radius:6px;border:1px solid ${cfg.student.border_color}">
    ${studentCols}
  </div>` : "";

  // ── Grades table ──────────────────────────────────────────────────────────
  const gradeRows = data.subjects.map((s, i) => {
    const bg = cfg.table.alt_row && i % 2 === 0 ? cfg.table.alt_row_color : "#ffffff";
    const gradeNum = parseFloat(s.grade);
    const gradeColor = cfg.table.pass_color && !isNaN(gradeNum)
      ? (gradeNum >= 10 ? "#166534" : "#dc2626")
      : "inherit";
    return `<tr style="background:${bg}">
      <td style="padding:5px 12px;border-bottom:1px solid #e5e7eb;font-size:11pt">${esc(s.name)}</td>
      <td style="padding:5px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:600;font-size:11pt;color:${gradeColor}">${esc(s.grade || "—")}</td>
    </tr>`;
  }).join("\n");

  const tableHtml = cfg.sections.grades_table ? `
  <table style="width:100%;border-collapse:collapse;margin-bottom:14px;border:1px solid #e5e7eb;border-radius:4px;overflow:hidden">
    <thead>
      <tr style="background:${cfg.table.header_bg};color:${cfg.table.header_text}">
        <th style="padding:7px 12px;text-align:left;font-size:11pt;font-weight:600">Área / Materia</th>
        <th style="padding:7px 12px;text-align:center;font-size:11pt;font-weight:600;width:100px">Calificación</th>
      </tr>
    </thead>
    <tbody>${gradeRows}</tbody>
  </table>` : "";

  // ── Summary ───────────────────────────────────────────────────────────────
  const hasBoth = cfg.summary.show_definitiva && cfg.summary.show_position;
  const defColor = (() => {
    const n = parseFloat(data.definitiva);
    if (!isNaN(n) && cfg.table.pass_color) return n >= 10 ? "#166534" : "#dc2626";
    return "#374151";
  })();
  const definitvaCard = cfg.summary.show_definitiva ? `
    <div style="background:${cfg.summary.definitiva_bg};border:1px solid ${cfg.summary.definitiva_border};border-radius:8px;padding:12px;text-align:center">
      <div style="font-size:8pt;color:#4b5563;text-transform:uppercase;letter-spacing:0.4px">Definitiva del Momento</div>
      <div style="font-size:24pt;font-weight:700;color:${defColor};margin-top:4px">${esc(data.definitiva || "—")}</div>
    </div>` : "";
  const posCard = cfg.summary.show_position ? `
    <div style="background:${cfg.summary.position_bg};border:1px solid ${cfg.summary.position_border};border-radius:8px;padding:12px;text-align:center">
      <div style="font-size:8pt;color:#4b5563;text-transform:uppercase;letter-spacing:0.4px">Posición en la Sección</div>
      <div style="font-size:24pt;font-weight:700;color:#1d4ed8;margin-top:4px">${data.position > 0 ? `${data.position}°` : "—"}</div>
    </div>` : "";

  const summaryHtml = cfg.sections.summary && (definitvaCard || posCard) ? `
  <div style="display:grid;grid-template-columns:${hasBoth ? "1fr 1fr" : "1fr"};gap:12px;margin-bottom:20px">
    ${definitvaCard}${posCard}
  </div>` : "";

  // ── Signatures ────────────────────────────────────────────────────────────
  const sigHtml = cfg.sections.signatures && data.signature_lines.length > 0 ? `
  <div style="display:flex;gap:16px;margin-top:8px;padding-top:8px">
    ${data.signature_lines.map((sig) => `
      <div style="text-align:center;flex:1;padding:0 8px">
        <div style="border-top:1px solid #374151;width:80%;margin:0 auto;padding-top:6px;font-size:9pt;color:#374151">${esc(sig)}</div>
      </div>`).join("")}
  </div>` : "";

  // ── Full HTML ─────────────────────────────────────────────────────────────
  const boletaDiv = `<div class="boleta">
  ${headerHtml}
  ${titleHtml}
  ${studentHtml}
  ${tableHtml}
  ${summaryHtml}
  ${sigHtml}
</div>`;

  if (opts?.bodyOnly) return boletaDiv;

  return /* html */`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Boleta — ${esc(data.student_name)}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:${paperWidthMm}mm;min-height:${paperHeightMm}mm;font-family:Arial,Helvetica,sans-serif;background:white}
    @page{size:${paperWidthMm}mm ${paperHeightMm}mm;margin:12mm 15mm}
    @media print{#controls{display:none!important}}
    #controls{padding:10px 20px;background:white;border-bottom:1px solid #e5e7eb;display:flex;gap:10px;align-items:center;position:sticky;top:0;z-index:10}
    #controls button{padding:7px 18px;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500}
    #btn-print{background:#2563eb;color:white}
    #btn-close{background:#e2e8f0;color:#374151}
    .boleta{padding:14mm 15mm}
  </style>
</head>
<body>
<div id="controls">
  <button id="btn-print" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
  <button id="btn-close" onclick="window.close()">Cerrar</button>
</div>
${boletaDiv}
</body>
</html>`;
}

// ─── Boletín Completo HTML generator ──────────────────────────────────────────

function fmtGrade(v: string | null | undefined): string {
  return v && v !== "0" && v !== "" ? v : "—";
}

function momentoCell(mg: BoletinMomentoGrade | null): string {
  const td = `text-align:center;padding:2px 2px;border:1px solid #ccc;font-size:8pt;overflow:hidden`;
  if (!mg) return `<td style="${td}"></td><td style="${td}"></td><td style="${td}"></td><td style="${td}"></td>`;
  return [
    `<td style="${td}">${esc(fmtGrade(mg.nota))}</td>`,
    `<td style="${td}">${esc(mg.ajuste && mg.ajuste !== "0" ? mg.ajuste : "")}</td>`,
    `<td style="${td};font-weight:600">${esc(fmtGrade(mg.definitiva))}</td>`,
    `<td style="${td}">${mg.inasistencias > 0 ? mg.inasistencias : ""}</td>`,
  ].join("");
}

export function generateBoletinCompletoHtml(
  cfg: BachilleratoConfig,
  data: BoletinCompletoRenderData,
  paperWidthMm: number,
  paperHeightMm: number,
  opts?: { bodyOnly?: boolean },
): string {
  const hc = data.header_cfg;
  const hdrBg  = cfg.boletin?.table_header_bg  ?? "#000000";
  const hdrTxt = cfg.boletin?.table_header_text ?? "#ffffff";
  const accentColor = cfg.header.accent_color;

  // ── Header ─────────────────────────────────────────────────────────────────
  const logoHtml = hc.show_logo && data.school_logo
    ? `<img src="${esc(data.school_logo)}" alt="Logo" style="height:70px;width:auto;object-fit:contain;margin-right:10px">`
    : "";

  const leftLines = [
    hc.show_name       ? `<div style="font-size:${cfg.header.name_font_size}pt;font-weight:700;text-transform:uppercase">${esc(data.school_name)}</div>` : "",
    hc.show_address    ? `<div style="font-size:${cfg.header.sub_font_size}pt">${esc(data.address)}</div>` : "",
    hc.show_dea_code   ? `<div style="font-size:${cfg.header.sub_font_size}pt">Cód. DEA: ${esc(data.dea_code)}</div>` : "",
    hc.show_phone      ? `<div style="font-size:${cfg.header.sub_font_size}pt">Tlf: ${esc(data.phone)}</div>` : "",
    hc.show_rif        ? `<div style="font-size:${cfg.header.sub_font_size}pt">RIF: ${esc(data.rif)}</div>` : "",
  ].filter(Boolean).join("");

  const rightBlock = `
    <div style="text-align:right;font-size:${cfg.header.sub_font_size}pt;line-height:1.6">
      <div>Año Escolar ${esc(data.year_range)}</div>
      ${data.position > 0 ? `<div>Posición en la sección: ${data.position}</div>` : ""}
    </div>`;

  const headerHtml = `
  <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px">
    <div style="display:flex;align-items:center">${logoHtml}<div>${leftLines}</div></div>
    ${rightBlock}
  </div>`;

  // ── Title ──────────────────────────────────────────────────────────────────
  const titleHtml = `
  <div style="text-align:center;margin-bottom:6px">
    <div style="font-size:14pt;font-weight:700;text-transform:uppercase;letter-spacing:0.5px">BOLETIN DE CALIFICACIONES</div>
  </div>`;

  // ── Student info ───────────────────────────────────────────────────────────
  const mentionPart = data.mention ? ` &nbsp;&nbsp; MENCIÓN <u>${esc(data.mention)}</u>` : "";
  const studentHtml = `
  <div style="font-size:10pt;margin-bottom:4px;line-height:1.8">
    <div>
      <span>Año o Grado: <u><strong>${esc(data.grade_label)}</strong></u></span>
      <span style="margin-left:16px">Sección <u>${esc(data.section_name)}</u></span>
      ${mentionPart}
      <span style="float:right">Lapso: ${data.lapso}</span>
    </div>
    <div>
      <span>Estudiante: <u><strong>${esc(data.student_name)}</strong></u></span>
      ${data.document_id ? `<span style="margin-left:24px">Documento: <u>${esc(data.document_id)}</u></span>` : ""}
    </div>
  </div>`;

  // ── Grades table + promedios sidebar ──────────────────────────────────────
  const thStyle = `background:${hdrBg};color:${hdrTxt};padding:3px 3px;border:1px solid #999;font-size:7.5pt;text-align:center;font-weight:600;overflow:hidden`;
  const subjectRows = data.subjects.map((s, i) => {
    const bg = cfg.table.alt_row && i % 2 !== 0 ? (cfg.table.alt_row_color || "#f9fafb") : "#ffffff";
    return `<tr style="background:${bg}">
      <td style="padding:2px 3px;border:1px solid #ccc;text-align:center;font-size:8pt">${s.number}</td>
      <td style="padding:2px 4px;border:1px solid #ccc;font-size:8pt;text-transform:uppercase;word-break:break-word">${esc(s.name)}</td>
      ${momentoCell(s.m1)}
      ${momentoCell(s.m2)}
      ${momentoCell(s.m3)}
      <td style="text-align:center;padding:2px 3px;border:1px solid #ccc;font-weight:700;font-size:8pt">${esc(fmtGrade(s.definitiva_final))}</td>
    </tr>`;
  }).join("\n");

  const tableHtml = `
  <table style="border-collapse:collapse;font-size:8pt;width:100%;table-layout:fixed">
    <colgroup>
      <col style="width:20px">
      <col><!-- Asignatura: fills remaining space -->
      <col style="width:22px"><col style="width:20px"><col style="width:26px"><col style="width:20px">
      <col style="width:22px"><col style="width:20px"><col style="width:26px"><col style="width:20px">
      <col style="width:22px"><col style="width:20px"><col style="width:26px"><col style="width:20px">
      <col style="width:26px">
    </colgroup>
    <thead>
      <tr>
        <th rowspan="2" style="${thStyle}">No.</th>
        <th rowspan="2" style="${thStyle};text-align:left;padding-left:4px">Asignatura</th>
        <th colspan="4" style="${thStyle}">I Momento</th>
        <th colspan="4" style="${thStyle}">II Momento</th>
        <th colspan="4" style="${thStyle}">III Momento</th>
        <th rowspan="2" style="${thStyle}">Def.</th>
      </tr>
      <tr>
        <th style="${thStyle}">Nota</th><th style="${thStyle}">Ajuste</th><th style="${thStyle}">Def.1M</th><th style="${thStyle}">Inas.</th>
        <th style="${thStyle}">Nota</th><th style="${thStyle}">Ajuste</th><th style="${thStyle}">Def.2M</th><th style="${thStyle}">Inas.</th>
        <th style="${thStyle}">Nota</th><th style="${thStyle}">Ajuste</th><th style="${thStyle}">Def.3M</th><th style="${thStyle}">Inas.</th>
      </tr>
    </thead>
    <tbody>${subjectRows}</tbody>
  </table>`;

  const boxStyle = (label: string, value: string) => `
    <div style="border:1px solid #000;padding:3px 6px;margin-top:4px;text-align:center">
      <div style="font-size:8pt">${label}</div>
      <div style="font-size:11pt;font-weight:700">${esc(value)}</div>
    </div>`;

  const hasM1 = data.avg_m1 && data.avg_m1 !== "0" && data.avg_m1 !== "—";
  const hasM2 = data.avg_m2 && data.avg_m2 !== "0" && data.avg_m2 !== "—";
  const hasM3 = data.avg_m3 && data.avg_m3 !== "0" && data.avg_m3 !== "—";

  const promediosHtml = `
  <div style="font-size:9pt;padding-left:10px;width:135px;flex-shrink:0">
    <div style="font-weight:700;margin-bottom:4px;font-size:9pt">Promedios</div>
    <table style="width:100%;font-size:8.5pt;border-collapse:collapse;white-space:nowrap">
      <tr><td style="padding-right:4px">I Momento:</td><td style="text-align:right;font-weight:600">${hasM1 ? esc(data.avg_m1) : "—"}</td></tr>
      <tr><td style="padding-right:4px">II Momento:</td><td style="text-align:right;font-weight:600">${hasM2 ? esc(data.avg_m2) : "—"}</td></tr>
      <tr><td style="padding-right:4px">III Momento:</td><td style="text-align:right;font-weight:600">${hasM3 ? esc(data.avg_m3) : "—"}</td></tr>
    </table>
    ${boxStyle("Prom. del Estudiante", data.avg_student || "—")}
    ${boxStyle("Prom. de la Sección", data.avg_section || "—")}
  </div>`;

  const mainHtml = `
  <div style="display:flex;align-items:flex-start;margin-bottom:12px">
    <div style="flex:1;min-width:0;overflow:hidden">${tableHtml}</div>
    ${promediosHtml}
  </div>`;

  // ── Signatures (from template config) ────────────────────────────────────
  const cfgSigs = cfg.boletin?.signatures ?? [];
  const sigHtml = cfg.sections.signatures && cfgSigs.length > 0 ? (() => {
    const cols = cfgSigs.map((sig) => {
      const firmaImg = sig.firma_url
        ? `<img src="${esc(sig.firma_url)}" alt="Firma" style="height:52px;object-fit:contain;display:block;margin:0 auto 2px">`
        : `<div style="height:52px"></div>`;
      const selloImg = sig.sello_url
        ? `<img src="${esc(sig.sello_url)}" alt="Sello" style="height:36px;object-fit:contain;display:inline-block;vertical-align:middle;margin-left:6px">`
        : "";
      return `<div style="text-align:center;flex:1">
        ${firmaImg}
        <div style="border-top:1px solid #000;width:80%;margin:0 auto;padding-top:6px">
          ${selloImg}
          <div style="font-size:9pt;font-weight:600">${esc(sig.nombre)}</div>
          ${sig.cedula ? `<div style="font-size:8.5pt">${esc(sig.cedula)}</div>` : ""}
          ${sig.cargo  ? `<div style="font-size:8.5pt">${esc(sig.cargo)}</div>`  : ""}
        </div>
      </div>`;
    });
    return `<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:15px">${cols.join("")}</div>`;
  })() : "";

  // ── Full HTML ──────────────────────────────────────────────────────────────
  const boletinDiv = `<div class="boletin">
  ${headerHtml}
  <hr style="border:none;border-top:2px solid ${accentColor};margin-bottom:6px">
  ${titleHtml}
  ${studentHtml}
  ${mainHtml}
  ${sigHtml}
</div>`;

  if (opts?.bodyOnly) return boletinDiv;

  return /* html */`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Boletín — ${esc(data.student_name)}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:${paperWidthMm}mm;font-family:Arial,Helvetica,sans-serif;background:white}
    @page{size:${paperWidthMm}mm ${paperHeightMm}mm;margin:0}
    @media print{#controls{display:none!important}.boletin{padding:4mm 12mm 6mm 12mm}}
    #controls{padding:10px 20px;background:white;border-bottom:1px solid #e5e7eb;display:flex;gap:10px;align-items:center;position:sticky;top:0;z-index:10}
    #controls button{padding:7px 18px;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500}
    #btn-print{background:#2563eb;color:white}
    #btn-close{background:#e2e8f0;color:#374151}
    .boletin{padding:3mm 12mm 8mm 12mm;width:100%}
  </style>
</head>
<body>
<div id="controls">
  <button id="btn-print" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
  <button id="btn-close" onclick="window.close()">Cerrar</button>
</div>
${boletinDiv}
</body>
</html>`;
}

// ─── Combined boletas wrapper ───────────────────────────────────────────────────

export function wrapAllBoletasHtml(
  bodies: string[],
  paperWidthMm: number,
  paperHeightMm: number,
  boletaStyle: "simple" | "boletin_completo",
): string {
  const pageMargin = boletaStyle === "boletin_completo" ? "0" : "12mm 15mm";
  const wrapped = bodies.map((b, i) =>
    `<div class="boleta-page${i === bodies.length - 1 ? " last" : ""}">${b}</div>`
  ).join("\n");
  return /* html */`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Boletas — Sección completa</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:${paperWidthMm}mm;font-family:Arial,Helvetica,sans-serif;background:white}
    @page{size:${paperWidthMm}mm ${paperHeightMm}mm;margin:${pageMargin}}
    @media print{#controls{display:none!important}.boletin{padding:4mm 12mm 6mm 12mm}.boleta-page{page-break-after:always}.boleta-page.last{page-break-after:avoid}}
    #controls{padding:10px 20px;background:white;border-bottom:1px solid #e5e7eb;display:flex;gap:10px;align-items:center;position:sticky;top:0;z-index:10}
    #controls button{padding:7px 18px;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500}
    #btn-print{background:#2563eb;color:white}
    #btn-close{background:#e2e8f0;color:#374151}
    .boleta{padding:14mm 15mm}
    .boletin{padding:3mm 12mm 8mm 12mm;width:100%}
    .boleta-page{page-break-after:always}
    .boleta-page.last{page-break-after:avoid}
  </style>
</head>
<body>
<div id="controls">
  <button id="btn-print" onclick="window.print()">🖨️ Imprimir / Guardar PDF (${bodies.length} boletas)</button>
  <button id="btn-close" onclick="window.close()">Cerrar</button>
</div>
${wrapped}
</body>
</html>`;
}
