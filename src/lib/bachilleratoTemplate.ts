// ─── Types ────────────────────────────────────────────────────────────────────

export interface BachilleratoConfig {
  sections: {
    header:      boolean;
    title:       boolean;
    student_info: boolean;
    grades_table: boolean;
    summary:     boolean;
    signatures:  boolean;
  };
  header: {
    accent_color:     string;   // border + school name color
    name_font_size:   number;   // pt, school name
    sub_font_size:    number;   // pt, codes / address
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
    pass_color:     boolean;   // green/red for ≥10 / <10
  };
  summary: {
    show_definitiva:   boolean;
    show_position:     boolean;
    definitiva_bg:     string;
    definitiva_border: string;
    position_bg:       string;
    position_border:   string;
  };
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
  return `<!DOCTYPE html>
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
<div class="boleta">
  ${headerHtml}
  ${titleHtml}
  ${studentHtml}
  ${tableHtml}
  ${summaryHtml}
  ${sigHtml}
</div>
</body>
</html>`;
}
