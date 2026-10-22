import { BoletinSignature, isBlankSignature } from "@/lib/bachilleratoTemplate";
import { isRichTextEmpty, sanitizeRichText } from "@/lib/richTextSanitize";

/**
 * Pure HTML render of the "Ficha descriptiva del estudiante (Diagnóstico)". No data access: the
 * caller resolves every image to a data URL first (html2canvas cannot draw cross-origin URLs).
 *
 * Every sheet is a `.boleta-page`, so `htmlToPdfBlob` prints one sheet per PDF page whether the
 * document holds one student or a whole section.
 */

export const DIAGNOSIS_PAPER = { widthMm: 215.9, heightMm: 279.4 } as const;

export interface DiagnosisSections {
  strengths: string;
  weaknesses: string;
  improvements: string;
}

export interface DiagnosisSheetData extends DiagnosisSections {
  schoolName: string;
  yearRange: string;
  studentName: string;
  documentId: string | null;
  gradeLabel: string;
  sectionName: string | null;
  /** Already composed (teacher first) and with images inlined. */
  signatures: BoletinSignature[];
}

export interface DiagnosisImages {
  headerLogo: string;
  footerLogo: string;
}

export const DIAGNOSIS_SECTION_TITLES: Record<keyof DiagnosisSections, string> = {
  strengths: "FORTALEZAS",
  weaknesses: "DEBILIDADES",
  improvements: "ASPECTOS A SUPERAR",
};

const SECTION_ORDER: (keyof DiagnosisSections)[] = ["strengths", "weaknesses", "improvements"];

function esc(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Signatures that actually print: switched on and with some data. */
export function printableSignatures(signatures: BoletinSignature[]): BoletinSignature[] {
  return signatures.filter((sig) => sig.enabled !== false && !isBlankSignature(sig));
}

function studentLine(data: DiagnosisSheetData): string {
  const field = (label: string, value: string) =>
    `<span style="white-space:nowrap;margin-right:14px"><b>${label}:</b> ${esc(value)}</span>`;
  return [
    field("NOMBRE DEL ESTUDIANTE", data.studentName),
    data.documentId ? field("C.I. / C.E.", data.documentId) : "",
    field("GRADO", data.gradeLabel),
    data.sectionName ? field("SECCIÓN", data.sectionName) : "",
  ].join("");
}

function sectionsHtml(data: DiagnosisSheetData): string {
  return SECTION_ORDER.filter((key) => !isRichTextEmpty(data[key]))
    .map(
      (key) => `<div class="dx-section">
        <div class="dx-section-title">${DIAGNOSIS_SECTION_TITLES[key]}:</div>
        <div class="dx-rich">${sanitizeRichText(data[key])}</div>
      </div>`,
    )
    .join("");
}

function signaturesHtml(signatures: BoletinSignature[]): string {
  const sigs = printableSignatures(signatures);
  if (sigs.length === 0) return "";
  const cols = sigs.map((sig) => {
    const firma = sig.firma_url
      ? `<img src="${esc(sig.firma_url)}" alt="Firma" style="height:52px;object-fit:contain;display:block;margin:0 auto 2px">`
      : `<div style="height:52px"></div>`;
    const sello = sig.sello_url
      ? `<img src="${esc(sig.sello_url)}" alt="Sello" style="height:36px;object-fit:contain;display:block;margin:4px auto 0">`
      : "";
    return `<div style="flex:1;text-align:center;min-width:0">
      ${firma}
      <div style="border-top:1px solid #000;width:85%;margin:0 auto;padding-top:5px">
        ${sig.cargo ? `<div style="font-size:9.5pt;font-weight:700">${esc(sig.cargo)}</div>` : ""}
        ${sig.nombre ? `<div style="font-size:9.5pt">${esc(sig.nombre)}</div>` : ""}
        ${sig.cedula ? `<div style="font-size:9pt">${esc(sig.cedula)}</div>` : ""}
        ${sello}
      </div>
    </div>`;
  });
  return `<div class="dx-signatures">${cols.join("")}</div>`;
}

/** Body of one sheet (one student), without the page wrapper. */
export function generateDiagnosisSheetBody(data: DiagnosisSheetData, images: DiagnosisImages): string {
  const header = images.headerLogo
    ? `<img src="${esc(images.headerLogo)}" alt="Ministerio del Poder Popular para la Educación" class="dx-header-logo">`
    : "";
  const footer = images.footerLogo
    ? `<img src="${esc(images.footerLogo)}" alt="" class="dx-footer-logo">`
    : "";
  return `<div class="dx-content">
    ${header}
    <div class="dx-title">FICHA DESCRIPTIVA DEL ESTUDIANTE (DIAGNÓSTICO)</div>
    ${data.schoolName ? `<div class="dx-subtitle">${esc(data.schoolName)}</div>` : ""}
    <div class="dx-subtitle">AÑO ESCOLAR ${esc(data.yearRange)}</div>
    <div class="dx-student">${studentLine(data)}</div>
    ${sectionsHtml(data)}
    ${signaturesHtml(data.signatures)}
  </div>
  ${footer}`;
}

/** Full document: one `.boleta-page` per sheet, Letter size. */
export function generateDiagnosisDocumentHtml(sheets: DiagnosisSheetData[], images: DiagnosisImages): string {
  const { widthMm, heightMm } = DIAGNOSIS_PAPER;
  const pages = sheets
    .map(
      (sheet, i) =>
        `<div class="boleta-page${i === sheets.length - 1 ? " last" : ""}">${generateDiagnosisSheetBody(sheet, images)}</div>`,
    )
    .join("\n");
  const title = sheets.length === 1 ? `Diagnóstico — ${esc(sheets[0].studentName)}` : `Diagnósticos (${sheets.length})`;
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:${widthMm}mm;font-family:Arial,Helvetica,sans-serif;background:white;color:#111}
    @page{size:${widthMm}mm ${heightMm}mm;margin:0}
    .boleta-page{width:${widthMm}mm;min-height:${heightMm}mm;display:flex;flex-direction:column;background:white}
    @media print{.boleta-page{page-break-after:always}.boleta-page.last{page-break-after:avoid}}
    .dx-content{flex:1;padding:12mm 16mm 4mm}
    .dx-header-logo{display:block;width:100%;height:auto;margin-bottom:8mm}
    .dx-title{text-align:center;font-weight:700;font-size:12.5pt;text-decoration:underline;margin-bottom:3px}
    .dx-subtitle{text-align:center;font-weight:700;font-size:10.5pt;margin-bottom:2px}
    .dx-student{font-size:10pt;margin:14px 0 10px;line-height:1.6;display:flex;flex-wrap:wrap}
    .dx-section{margin-top:10px;font-size:10.5pt;line-height:1.45}
    .dx-section-title{font-weight:700;text-decoration:underline;margin-bottom:4px}
    .dx-rich ul,.dx-rich ol{padding-left:22px;margin:2px 0}
    .dx-rich li{margin-bottom:2px}
    .dx-rich p{margin:2px 0}
    .dx-rich h1,.dx-rich h2,.dx-rich h3,.dx-rich h4{font-size:10.5pt;font-weight:700;margin:6px 0 2px}
    .dx-rich table{border-collapse:collapse;margin:4px 0}
    .dx-rich td,.dx-rich th{border:1px solid #999;padding:2px 6px}
    .dx-signatures{display:flex;gap:10px;align-items:flex-end;margin-top:28px}
    .dx-footer-logo{display:block;width:100%;height:auto}
  </style>
</head>
<body>
${pages}
</body>
</html>`;
}
