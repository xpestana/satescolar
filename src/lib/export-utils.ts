import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import QRCode from "qrcode";

interface ExportColumn {
  key: string;
  label: string;
}

type RecordRow = Record<string, any>;

export interface PdfSchoolInfo {
  name: string;
  deaCode: string;
  statisticalCode?: string;
  address: string;
  state: string;
  municipality: string;
  city: string;
  parish: string;
  logoUrl?: string;
  phone?: string;
  rif?: string;
}

export interface PdfHeaderConfig {
  show_logo?: boolean;
  show_name?: boolean;
  show_dea_code?: boolean;
  show_statistical_code?: boolean;
  show_address?: boolean;
  show_phone?: boolean;
  show_rif?: boolean;
}

export interface PdfFooterConfig {
  show_address?: boolean;
  show_phone?: boolean;
  show_rif?: boolean;
}

function sanitize(val: any): string {
  if (val == null || val === "—") return "";
  return String(val);
}

// ── CSV ──────────────────────────────────────────────
export function downloadCSV(
  columns: ExportColumn[],
  rows: RecordRow[],
  filename: string
) {
  const escape = (v: string) =>
    v.includes(",") || v.includes('"') || v.includes("\n")
      ? `"${v.replace(/"/g, '""')}"`
      : v;

  const header = columns.map((c) => escape(c.label)).join(",");
  const body = rows
    .map((r) => columns.map((c) => escape(sanitize(r[c.key]))).join(","))
    .join("\n");

  const blob = new Blob(["\uFEFF" + header + "\n" + body], {
    type: "text/csv;charset=utf-8;",
  });
  triggerDownload(blob, `${filename}.csv`);
}

// ── Excel ────────────────────────────────────────────
export function downloadExcel(
  columns: ExportColumn[],
  rows: RecordRow[],
  filename: string
) {
  const data = rows.map((r) => {
    const obj: Record<string, string> = {};
    columns.forEach((c) => {
      obj[c.label] = sanitize(r[c.key]);
    });
    return obj;
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Datos");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// ── PDF ──────────────────────────────────────────────
async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function downloadPDF(
  columns: ExportColumn[],
  rows: RecordRow[],
  filename: string,
  schoolInfo?: PdfSchoolInfo,
  headerConfig?: PdfHeaderConfig,
  footerConfig?: PdfFooterConfig
) {
  // Default: show everything if no config provided
  const hc: PdfHeaderConfig = headerConfig ?? {
    show_logo: true, show_name: true, show_dea_code: true,
    show_statistical_code: true, show_address: true, show_phone: true, show_rif: true,
  };
  const fc: PdfFooterConfig = footerConfig ?? {
    show_address: true, show_phone: true, show_rif: true,
  };
  const isLandscape = columns.length > 6;
  const doc = new jsPDF({ orientation: isLandscape ? "landscape" : "portrait" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let startY = 15;

  if (schoolInfo) {
    const now = new Date();
    const dateStr = `Fecha de emisión: ${now.toLocaleDateString("es-VE", {
      year: "numeric", month: "2-digit", day: "2-digit",
    })} ${now.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })}`;

    // Date top-right
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(dateStr, pageWidth - margin, startY, { align: "right" });

    // Logo
    let textX = margin;
    if (hc.show_logo !== false && schoolInfo.logoUrl) {
      const logoBase64 = await loadImageAsBase64(schoolInfo.logoUrl);
      if (logoBase64) {
        doc.addImage(logoBase64, "PNG", margin, startY + 2, 22, 22);
        textX = margin + 26;
      }
    }

    // Institution info
    const infoX = textX;
    let infoY = startY + 5;

    doc.setFontSize(9);
    doc.setTextColor(0);
    doc.text("República Bolivariana de Venezuela", infoX, infoY);
    infoY += 5;

    if (hc.show_name !== false) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(schoolInfo.name.toUpperCase(), infoX, infoY);
      infoY += 5;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(60);

    // Codes line
    const codeParts: string[] = [];
    if (hc.show_dea_code !== false) codeParts.push(`Código DEA: ${schoolInfo.deaCode}`);
    if (hc.show_statistical_code !== false && schoolInfo.statisticalCode) codeParts.push(`Código Estadístico: ${schoolInfo.statisticalCode}`);
    if (codeParts.length > 0) {
      doc.text(codeParts.join("  -  "), infoX, infoY);
      infoY += 4;
    }

    // RIF in header
    if (hc.show_rif !== false && schoolInfo.rif) {
      doc.text(`RIF: ${schoolInfo.rif}`, infoX, infoY);
      infoY += 4;
    }

    // Address line
    if (hc.show_address !== false) {
      const addressParts = [schoolInfo.address];
      if (schoolInfo.parish) addressParts.push(`Parroquia: ${schoolInfo.parish}`);
      if (schoolInfo.municipality) addressParts.push(`Municipio: ${schoolInfo.municipality}`);
      if (schoolInfo.city) addressParts.push(`Ciudad: ${schoolInfo.city}`);
      if (schoolInfo.state) addressParts.push(`Estado: ${schoolInfo.state}`);
      const addressLine = addressParts.filter(Boolean).join("   ");
      const maxWidth = pageWidth - infoX - margin;
      const addressLines = doc.splitTextToSize(addressLine, maxWidth);
      doc.text(addressLines, infoX, infoY);
      infoY += addressLines.length * 4;
    }

    // Phone in header
    if (hc.show_phone !== false && schoolInfo.phone) {
      doc.text(`Tel: ${schoolInfo.phone}`, infoX, infoY);
      infoY += 4;
    }

    // Separator line
    infoY += 2;
    doc.setDrawColor(41, 128, 185);
    doc.setLineWidth(0.5);
    doc.line(margin, infoY, pageWidth - margin, infoY);

    startY = infoY + 6;

    // Report title
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text(`Reporte de ${filename}`, pageWidth / 2, startY, { align: "center" });
    doc.setFont("helvetica", "normal");
    startY += 8;
  }

  autoTable(doc, {
    head: [columns.map((c) => c.label)],
    body: rows.map((r) => columns.map((c) => sanitize(r[c.key]))),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [41, 128, 185], fontSize: 7 },
    margin: { top: startY, left: margin, right: margin },
    didDrawPage: (data) => {
      const pageHeight = doc.internal.pageSize.getHeight();
      const pageCount = (doc as any).internal.getNumberOfPages();

      // School footer info
      if (schoolInfo) {
        const footerParts: string[] = [];
        if (fc.show_address !== false) {
          const addrParts = [schoolInfo.address];
          if (schoolInfo.parish) addrParts.push(`Parroquia: ${schoolInfo.parish}`);
          if (schoolInfo.municipality) addrParts.push(`Municipio: ${schoolInfo.municipality}`);
          if (schoolInfo.state) addrParts.push(schoolInfo.state);
          footerParts.push(addrParts.filter(Boolean).join(", "));
        }
        if (fc.show_phone !== false && schoolInfo.phone) footerParts.push(`Tel: ${schoolInfo.phone}`);
        if (fc.show_rif !== false && schoolInfo.rif) footerParts.push(`RIF: ${schoolInfo.rif}`);

        if (footerParts.length > 0) {
          doc.setFontSize(6);
          doc.setTextColor(130);
          doc.text(footerParts.join("  |  "), pageWidth / 2, pageHeight - 12, { align: "center" });
        }
      }

      // Page number
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(
        `Página ${data.pageNumber} de ${pageCount}`,
        pageWidth / 2,
        pageHeight - 8,
        { align: "center" }
      );
    },
  });

  doc.save(`${filename}.pdf`);
}

// ── Carnet (vertical) ────────────────────────────────
export interface CarnetLayoutParams {
  headerHeight?: number;
  photoSize?: number;
  photoPos?: { x: number; y: number };
  namePos?: { x: number; y: number };
  badgePos?: { x: number; y: number };
  docPos?: { x: number; y: number };
  qrPos?: { x: number; y: number };
  qrSize?: number;
  schoolNamePos?: { x: number; y: number };
  cityPos?: { x: number; y: number };
  yearPos?: { x: number; y: number };
  logoPos?: { x: number; y: number };
  logoSize?: number;
  fontSizes?: {
    schoolName?: number;
    studentName?: number;
    document?: number;
  };
}

export async function downloadCarnet(params: {
  personName: string;
  documentId: string;
  role: "ESTUDIANTE" | "REPRESENTANTE" | "DOCENTE";
  photoUrl?: string;
  schoolName: string;
  schoolLocation: string;
  schoolLogoUrl?: string;
  schoolYear: string;
  primaryColor?: string;
  secondaryColor?: string;
  watermarkUrl?: string;
  watermarkOpacity?: number;
  watermarkSize?: number;
  layoutConfig?: CarnetLayoutParams;
}) {
  const w = 53.98;
  const h = 85.6;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: [w, h] });

  // Layout defaults
  const lc = params.layoutConfig || {};
  const headerH = ((lc.headerHeight ?? 88) / 342) * h; // convert from px proportion to mm
  const logoPos = lc.logoPos ?? { x: 50, y: 20 };
  const logoSizePx = lc.logoSize ?? 32;
  const logoSizeMm = (logoSizePx / 342) * h;
  const schoolNamePos = lc.schoolNamePos ?? { x: 50, y: 55 };
  const cityPos = lc.cityPos ?? { x: 50, y: 72 };
  const yearPos = lc.yearPos ?? { x: 50, y: 85 };
  const photoPos = lc.photoPos ?? { x: 50, y: 15 };
  const photoSizePx = lc.photoSize ?? 56;
  const photoR = ((photoSizePx / 342) * h) / 2;
  const namePos = lc.namePos ?? { x: 50, y: 52 };
  const badgePos = lc.badgePos ?? { x: 50, y: 62 };
  const docPos = lc.docPos ?? { x: 50, y: 74 };
  const qrPos = lc.qrPos ?? { x: 50, y: 85 };
  const qrSizePx = lc.qrSize ?? 44;
  const qrSizeMm = ((qrSizePx / 342) * h);
  const fontSizes = {
    schoolName: lc.fontSizes?.schoolName ?? 8,
    studentName: lc.fontSizes?.studentName ?? 9,
    document: lc.fontSizes?.document ?? 8,
  };

  // Scale font from preview px to PDF points (preview is 342px tall = 85.6mm)
  const fontScale = 0.55; // approximate px-to-pt ratio for this card size

  // Helper: convert percentage position to mm coordinates
  const headerMm = (pos: { x: number; y: number }) => ({
    x: (pos.x / 100) * w,
    y: (pos.y / 100) * headerH,
  });
  const bodyTop = headerH + (1 / 342) * h; // after stripe
  const bodyH = h - bodyTop - 4; // minus bottom bar
  const bodyMm = (pos: { x: number; y: number }) => ({
    x: (pos.x / 100) * w,
    y: bodyTop + (pos.y / 100) * bodyH,
  });

  // Parse colors
  const pc = hexToRgb(params.primaryColor || "#01051e");
  const sc = hexToRgb(params.secondaryColor || "#1e78c8");
  const sc2 = { r: Math.min(sc.r + 20, 255), g: Math.min(sc.g + 30, 255), b: Math.min(sc.b + 30, 255) };

  // ── FRONT SIDE ──
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, w, h, "F");

  // Top header
  doc.setFillColor(pc.r, pc.g, pc.b);
  doc.rect(0, 0, w, headerH, "F");

  // Symmetric triangles
  const triH = headerH * 0.77;
  doc.setFillColor(sc.r, sc.g, sc.b);
  doc.triangle(0, 0, 10, 0, 0, triH, "F");
  doc.setFillColor(sc2.r, sc2.g, sc2.b);
  doc.triangle(w, 0, w - 10, 0, w, triH, "F");

  // Stripe
  doc.setFillColor(sc.r, sc.g, sc.b);
  doc.rect(0, headerH, w, 1, "F");

  // School logo in header
  if (params.schoolLogoUrl) {
    const logoB64 = await loadImageAsBase64(params.schoolLogoUrl);
    if (logoB64) {
      const lp = headerMm(logoPos);
      try { doc.addImage(logoB64, "PNG", lp.x - logoSizeMm / 2, lp.y - logoSizeMm / 2, logoSizeMm, logoSizeMm); } catch { /* ignore */ }
    }
  }

  // School name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(fontSizes.schoolName * fontScale);
  doc.setFont("helvetica", "bold");
  const snp = headerMm(schoolNamePos);
  const nameLines = doc.splitTextToSize(params.schoolName.toUpperCase(), w - 16);
  doc.text(nameLines, snp.x, snp.y, { align: "center" });

  // City/Location
  doc.setFontSize(3);
  doc.setFont("helvetica", "normal");
  const cp = headerMm(cityPos);
  doc.text(params.schoolLocation, cp.x, cp.y, { align: "center" });

  // Year
  const yp = headerMm(yearPos);
  doc.text(`Año Escolar: ${params.schoolYear}`, yp.x, yp.y, { align: "center" });

  // ── Watermark ──
  const wmUrl = params.watermarkUrl || params.schoolLogoUrl;
  const wmOpacity = params.watermarkOpacity ?? 0.06;
  const wmSize = params.watermarkSize ?? 30;
  if (wmUrl) {
    const wmB64 = await loadImageAsBase64(wmUrl);
    if (wmB64) {
      try {
        doc.saveGraphicsState();
        doc.setGState(new (doc as any).GState({ opacity: wmOpacity }));
        const wmY = bodyTop + bodyH / 2 - wmSize / 2;
        doc.addImage(wmB64, "PNG", w / 2 - wmSize / 2, wmY, wmSize, wmSize);
        doc.restoreGraphicsState();
      } catch { /* ignore */ }
    }
  }

  // ── Photo circle ──
  const pp = bodyMm(photoPos);
  doc.setFillColor(255, 255, 255);
  doc.circle(pp.x, pp.y, photoR + 0.5, "F");
  doc.setDrawColor(sc.r, sc.g, sc.b);
  doc.setLineWidth(0.8);
  doc.circle(pp.x, pp.y, photoR + 0.3);

  if (params.photoUrl) {
    const photoB64 = await loadImageAsBase64(params.photoUrl);
    if (photoB64) {
      try {
        const circularB64 = await createCircularImage(photoB64, 300);
        if (circularB64) {
          doc.addImage(circularB64, "PNG", pp.x - photoR, pp.y - photoR, photoR * 2, photoR * 2);
        }
      } catch { /* ignore */ }
    }
  }

  // ── Name ──
  const np = bodyMm(namePos);
  doc.setTextColor(pc.r, pc.g, pc.b);
  doc.setFontSize(fontSizes.studentName * fontScale);
  doc.setFont("helvetica", "bold");
  const personLines = doc.splitTextToSize(params.personName.toUpperCase(), w - 8);
  doc.text(personLines, np.x, np.y, { align: "center" });

  // ── Role badge ──
  const bp = bodyMm(badgePos);
  doc.setFillColor(sc.r, sc.g, sc.b);
  const badgeW = 22;
  const badgeH2 = 4.5;
  doc.roundedRect(bp.x - badgeW / 2, bp.y - badgeH2 / 2, badgeW, badgeH2, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(4.5);
  doc.setFont("helvetica", "bold");
  doc.text(params.role, bp.x, bp.y + 1.5, { align: "center" });

  // ── Document ID ──
  const dp = bodyMm(docPos);
  doc.setTextColor(pc.r, pc.g, pc.b);
  doc.setFontSize(fontSizes.document * fontScale);
  doc.setFont("helvetica", "bold");
  doc.text(params.documentId || "Sin documento", dp.x, dp.y, { align: "center" });

  // ── QR Code ──
  const qp = bodyMm(qrPos);
  const qrContent = params.documentId || params.personName;
  try {
    const qrDataUrl = await QRCode.toDataURL(qrContent, {
      width: 300, margin: 0,
      color: { dark: params.primaryColor || "#01051e", light: "#ffffff" },
    });
    doc.addImage(qrDataUrl, "PNG", qp.x - qrSizeMm / 2, qp.y - qrSizeMm / 2, qrSizeMm, qrSizeMm);
  } catch { /* ignore */ }

  // ── Bottom bar ──
  doc.setFillColor(pc.r, pc.g, pc.b);
  doc.rect(0, h - 4, w, 4, "F");
  doc.setFillColor(sc.r, sc.g, sc.b);
  doc.triangle(w, h, w - 16, h, w, h - 4, "F");
  doc.setFillColor(sc2.r, sc2.g, sc2.b);
  doc.triangle(0, h, 12, h, 0, h - 4, "F");

  const safeName = params.personName.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, "").trim().replace(/\s+/g, "_");
  doc.save(`Carnet_${safeName}.pdf`);
}

// ── Circular image helper ────────────────────────────
function createCircularImage(base64: string, size: number): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(null); return; }
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      // Draw image centered/covering the circle
      const minDim = Math.min(img.width, img.height);
      const sx = (img.width - minDim) / 2;
      const sy = (img.height - minDim) / 2;
      ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(null);
    img.src = base64;
  });
}

// ── Helpers ──────────────────────────────────────────
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16) || 0,
    g: parseInt(h.substring(2, 4), 16) || 0,
    b: parseInt(h.substring(4, 6), 16) || 0,
  };
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Planilla de Inscripción ──────────────────────────
export interface PlanillaData {
  student: any;
  representative: any;
  family: any;
  school: any;
  schoolGeo: { state?: string; municipality?: string; city?: string; parish?: string };
  sections: any[];
  generalConfig: any;
  schoolYear: string;
  enrollment?: any;
  enrollmentSection?: any;
  formFields?: any[];
  geoCache?: Record<string, string>; // UUID -> name mapping for geographic fields
}

function resolveFieldValue(
  fieldKey: string,
  data: PlanillaData
): string {
  const [prefix, ...rest] = fieldKey.split(":");
  const fieldName = rest.join(":");
  if (!fieldName) return "No registrado";

  const studentFd = (data.student?.form_data || {}) as Record<string, any>;
  const repFd = (data.representative?.form_data || {}) as Record<string, any>;

  // Calculate age helper
  const calcAge = (dateStr: string | undefined): string => {
    if (!dateStr) return "No registrado";
    const birth = new Date(dateStr);
    if (isNaN(birth.getTime())) return "No registrado";
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return `${age} años`;
  };

  const formatDate = (dateStr: string | undefined): string => {
    if (!dateStr) return "No registrado";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("es-VE", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  switch (prefix) {
    case "student": {
      if (fieldName === "_edad") return calcAge(studentFd.fecha_nacimiento);
      if (fieldName === "fecha_nacimiento") return formatDate(studentFd.fecha_nacimiento);
      if (fieldName === "documento") return data.student?.document_id || studentFd.documento || "No registrado";
      if (fieldName === "grado" || fieldName === "nivel_grado") {
        if (data.enrollmentSection) {
          const gradeLevel = data.enrollmentSection.grade_level || "";
          const sectionName = data.enrollmentSection.name || "";
          const GRADE_LABELS: Record<string, string> = {
            pre_maternal: "Pre-Maternal", maternal: "Maternal", inicial: "Inicial",
            primaria: "Primaria", media_general: "Media General", media_tecnica: "Media Técnica",
          };
          const gradeLabel = GRADE_LABELS[gradeLevel] || gradeLevel;
          return `${gradeLabel}${sectionName ? ` - Sección ${sectionName}` : ""}` || studentFd.nivel_grado || studentFd.grado || "No registrado";
        }
        return studentFd.nivel_grado || studentFd.grado || "No registrado";
      }
      const val = studentFd[fieldName] || "No registrado";
      // Resolve UUID geographic fields
      if (data.geoCache && val && val.match(/^[0-9a-f]{8}-[0-9a-f]{4}-/i)) {
        return data.geoCache[val] || val;
      }
      return val;
    }
    case "representative": {
      if (fieldName === "_edad") return calcAge(repFd.fecha_nacimiento);
      if (fieldName === "fecha_nacimiento") return formatDate(repFd.fecha_nacimiento);
      if (fieldName === "documento") return data.representative?.document_id || repFd.documento || "No registrado";
      if (fieldName === "numero_contacto") return data.representative?.phone || repFd.numero_contacto || "No registrado";
      const val = repFd[fieldName] || "No registrado";
      if (data.geoCache && val && val.match(/^[0-9a-f]{8}-[0-9a-f]{4}-/i)) {
        return data.geoCache[val] || val;
      }
      return val;
    }
    case "family": {
      const f = data.family;
      if (!f) return "No registrado";
      if (fieldName === "email") return f.email || "No registrado";
      if (fieldName === "contact_phone") return f.contact_phone || "No registrado";
      if (fieldName === "address") return f.address || "No registrado";
      if (fieldName === "location_full") {
        const parts = [
          data.schoolGeo.parish ? `Parroquia ${data.schoolGeo.parish}` : null,
          data.schoolGeo.municipality ? `Municipio ${data.schoolGeo.municipality}` : null,
          data.schoolGeo.city ? `Ciudad ${data.schoolGeo.city}` : null,
          data.schoolGeo.state ? `Estado ${data.schoolGeo.state}` : null,
        ].filter(Boolean);
        return parts.length > 0 ? parts.join(", ") : "No registrado";
      }
      const fVal = (f as any)[fieldName] || "No registrado";
      if (data.geoCache && fVal && typeof fVal === "string" && fVal.match(/^[0-9a-f]{8}-[0-9a-f]{4}-/i)) {
        return data.geoCache[fVal] || fVal;
      }
      return fVal;
    }
    case "custom": {
      // Custom fields - check enrollment data first, then student form_data
      if (fieldName === "tipo_de_estudiante" && data.enrollment?.enrollment_type) {
        return data.enrollment.enrollment_type;
      }
      if (fieldName === "fecha_de_inscripcion" && data.enrollment?.enrollment_date) {
        return formatDate(data.enrollment.enrollment_date);
      }
      if (fieldName === "grupo_asignado" && data.enrollmentSection) {
        const gradeLabel = data.enrollmentSection.grade_level || "";
        const sectionName = data.enrollmentSection.name || "";
        return `${gradeLabel} - ${sectionName}`.trim() || "No registrado";
      }
      return studentFd[fieldName] || "No registrado";
    }
    default:
      return "No registrado";
  }
}

function getFieldLabel(fieldKey: string, data: PlanillaData): string {
  const [prefix, ...rest] = fieldKey.split(":");
  const fieldName = rest.join(":");
  
  // Check form_fields for label
  if (data.formFields) {
    const ff = data.formFields.find(f => f.field_name === fieldName);
    if (ff) return ff.field_label;
  }

  // Fallback labels
  const labels: Record<string, string> = {
    "primer_nombre": "Primer Nombre", "segundo_nombre": "Segundo Nombre",
    "primer_apellido": "Primer Apellido", "segundo_apellido": "Segundo Apellido",
    "documento": "Documento", "email": "Correo Electrónico", "correo_electronico": "Correo Electrónico",
    "numero_contacto": "Teléfono", "telefono": "Teléfono", "_edad": "Edad",
    "fecha_nacimiento": "Fecha de Nacimiento", "ciudad_nacimiento": "Lugar de Nacimiento",
    "pais_nacimiento": "País de Nacimiento", "grado": "Grado o Año a Cursar",
    "contact_phone": "Teléfono", "address": "Dirección", "location_full": "Ubicación",
    "grupo_asignado": "Grupo asignado", "tipo_de_estudiante": "Tipo de Estudiante",
    "fecha_de_inscripcion": "Fecha de inscripción",
  };
  return labels[fieldName] || fieldName.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
}

export async function downloadPlanillaInscripcion(planillaData: PlanillaData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;

  const hc = planillaData.generalConfig?.header_config || {};
  const fc = planillaData.generalConfig?.footer_config || {};
  const signatureLines: string[] = planillaData.generalConfig?.signature_lines || ["Firma del Representante", "Firma del Director(a)"];

  // Preload images
  let logoB64: string | null = null;
  let studentPhotoB64: string | null = null;
  let repPhotoB64: string | null = null;

  if (planillaData.school?.logo_url && hc.show_logo !== false) {
    logoB64 = await loadImageAsBase64(planillaData.school.logo_url);
  }
  if (planillaData.student?.photo_url && hc.show_student_photo !== false) {
    studentPhotoB64 = await loadImageAsBase64(planillaData.student.photo_url);
  }
  if (planillaData.representative?.photo_url && hc.show_representative_photo !== false) {
    repPhotoB64 = await loadImageAsBase64(planillaData.representative.photo_url);
  }

  const studentFd = (planillaData.student?.form_data || {}) as Record<string, any>;
  const repFd = (planillaData.representative?.form_data || {}) as Record<string, any>;
  const studentName = `${studentFd.primer_nombre || ""} ${studentFd.segundo_nombre || ""} ${studentFd.primer_apellido || ""} ${studentFd.segundo_apellido || ""}`.replace(/\s+/g, " ").trim();

  // Footer height reservation
  const footerHeight = 30;

  function drawHeader(pageDoc: jsPDF): number {
    let y = 10;
    const school = planillaData.school;

    // Logo left
    if (logoB64) {
      try { pageDoc.addImage(logoB64, "PNG", margin, y, 18, 18); } catch {}
    }

    // Photos right
    const photoSize = 18;
    let photosX = pageWidth - margin - photoSize;
    if (studentPhotoB64) {
      try { pageDoc.addImage(studentPhotoB64, "JPEG", photosX, y, photoSize, photoSize); } catch {}
      photosX -= photoSize + 2;
    }
    if (repPhotoB64) {
      try { pageDoc.addImage(repPhotoB64, "JPEG", photosX, y, photoSize, photoSize); } catch {}
    }

    // Center text
    const centerX = pageWidth / 2;
    let textY = y + 4;
    pageDoc.setFontSize(11);
    pageDoc.setFont("helvetica", "bold");
    pageDoc.setTextColor(0);
    if (hc.show_name !== false && school?.name) {
      pageDoc.text(school.name.toUpperCase(), centerX, textY, { align: "center" });
      textY += 5;
    }

    pageDoc.setFont("helvetica", "normal");
    pageDoc.setFontSize(8);
    pageDoc.setTextColor(60);

    // Address line
    if (hc.show_address !== false && school?.address) {
      const addrParts = [school.address];
      if (planillaData.schoolGeo.parish) addrParts.push(`Parroquia ${planillaData.schoolGeo.parish}`);
      if (planillaData.schoolGeo.municipality) addrParts.push(`Municipio ${planillaData.schoolGeo.municipality}`);
      if (planillaData.schoolGeo.city) addrParts.push(planillaData.schoolGeo.city);
      if (planillaData.schoolGeo.state) addrParts.push(planillaData.schoolGeo.state);
      const addrLine = addrParts.filter(Boolean).join(", ");
      const addrLines = pageDoc.splitTextToSize(addrLine, contentWidth - 80);
      pageDoc.text(addrLines, centerX, textY, { align: "center" });
      textY += addrLines.length * 4;
    }

    // Codes
    const codeParts: string[] = [];
    if (hc.show_dea_code !== false && school?.dea_code) codeParts.push(`Código DEA: ${school.dea_code}`);
    if (hc.show_statistical_code !== false && school?.statistical_code) codeParts.push(`Código Estadístico: ${school.statistical_code}`);
    if (codeParts.length > 0) {
      pageDoc.text(codeParts.join(" - "), centerX, textY, { align: "center" });
      textY += 4;
    }

    // Phone & RIF
    const infoParts: string[] = [];
    if (hc.show_phone !== false && school?.phone) infoParts.push(`Tel: ${school.phone}`);
    if (hc.show_rif !== false && school?.rif) infoParts.push(`Rif: ${school.rif}`);
    if (infoParts.length > 0) {
      pageDoc.text(infoParts.join(" - "), centerX, textY, { align: "center" });
      textY += 4;
    }

    y = Math.max(y + 28, textY + 8);

    // PLANILLA title
    pageDoc.setFontSize(16);
    pageDoc.setFont("helvetica", "bold");
    pageDoc.setTextColor(0);
    pageDoc.text("PLANILLA", centerX, y, { align: "center" });
    y += 7;

    pageDoc.setFontSize(13);
    pageDoc.text(`AÑO ESCOLAR: ${planillaData.schoolYear}`, centerX, y, { align: "center" });
    y += 6;

    // Warning text
    pageDoc.setFontSize(7);
    pageDoc.setFont("helvetica", "italic");
    pageDoc.setTextColor(100);
    pageDoc.text(
      "Lea detenidamente esta planilla, los datos suministrados deben ser exactos y ajustados a la realidad, de lo contrario será invalidada",
      centerX, y, { align: "center" }
    );
    y += 12;

    return y;
  }

  function drawFooter(pageDoc: jsPDF) {
    let y = pageHeight - footerHeight;

    // Signature lines
    if (signatureLines.length > 0) {
      const lineWidth = 60;
      const gap = 20;
      const totalW = signatureLines.length * lineWidth + (signatureLines.length - 1) * gap;
      let startX = (pageWidth - totalW) / 2;

      pageDoc.setDrawColor(0);
      pageDoc.setLineWidth(0.3);
      pageDoc.setFontSize(9);
      pageDoc.setFont("helvetica", "normal");
      pageDoc.setTextColor(0);

      signatureLines.forEach((label, i) => {
        const x = startX + i * (lineWidth + gap);
        pageDoc.line(x, y, x + lineWidth, y);
        pageDoc.text(label, x + lineWidth / 2, y + 5, { align: "center" });
      });
      y += 12;
    }

    // Footer info
    const footerParts: string[] = [];
    if (fc.show_address !== false && planillaData.school?.address) {
      const addrParts = [planillaData.school.address];
      if (planillaData.schoolGeo.parish) addrParts.push(`Parroquia ${planillaData.schoolGeo.parish}`);
      if (planillaData.schoolGeo.municipality) addrParts.push(`Municipio ${planillaData.schoolGeo.municipality}`);
      if (planillaData.schoolGeo.city) addrParts.push(planillaData.schoolGeo.city);
      if (planillaData.schoolGeo.state) addrParts.push(planillaData.schoolGeo.state);
      footerParts.push(addrParts.filter(Boolean).join(", "));
    }
    if (fc.show_phone !== false && planillaData.school?.phone) footerParts.push(`Tel: ${planillaData.school.phone}`);
    if (fc.show_rif !== false && planillaData.school?.rif) footerParts.push(`Rif: ${planillaData.school.rif}`);

    if (footerParts.length > 0) {
      pageDoc.setFontSize(7);
      pageDoc.setTextColor(100);
      const footerLine = footerParts.join("  ");
      const footerLines = pageDoc.splitTextToSize(footerLine, contentWidth);
      pageDoc.text(footerLines, pageWidth / 2, y, { align: "center" });
      y += footerLines.length * 3.5;
    }

    pageDoc.setFontSize(6);
    pageDoc.setTextColor(130);
    pageDoc.text("Documento generado de forma automática por SAT Escolar", pageWidth / 2, pageHeight - 5, { align: "center" });
  }

  function ensureSpace(currentY: number, needed: number): number {
    if (currentY + needed > pageHeight - footerHeight) {
      drawFooter(doc);
      doc.addPage();
      return drawHeader(doc);
    }
    return currentY;
  }

  // ── PAGE 1 ──
  let y = drawHeader(doc);

  // Render each section (no hardcoded mini-table — the first dynamic section handles student data)
  for (const section of planillaData.sections) {
    // Estimate full section height to avoid splitting across pages
    let estimatedHeight = 10; // title + spacing
    if (section.section_type === "fields") {
      const fieldNames: string[] = Array.isArray(section.field_names) ? section.field_names : [];
      const familyTextFields = ["family:email", "family:contact_phone", "family:address", "family:location_full"];
      const isFamilyTextSection = fieldNames.every(f => familyTextFields.includes(f));
      if (isFamilyTextSection) {
        estimatedHeight += fieldNames.length * 6 + 4;
      } else {
        const chunks = Math.ceil(fieldNames.length / 4);
        estimatedHeight += chunks * 20 + 4; // ~20mm per table chunk
      }
    } else if (section.section_type === "text") {
      const text = section.section_text || "";
      const lines = doc.splitTextToSize(text, contentWidth);
      estimatedHeight += lines.length * 4.5 + 8;
    }

    // If section won't fit, jump to next page
    y = ensureSpace(y, estimatedHeight);

    // Section title
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);

    // For family section, show family name
    let titleText = section.title;
    if (section.title.toLowerCase().includes("familia") && planillaData.family) {
      const famName = `${planillaData.family.father_last_name || ""} ${planillaData.family.mother_last_name || ""}`.trim();
      if (famName) titleText = `${section.title} ${famName}`;
    }

    // For representative section, show parentesco
    if (section.title.toLowerCase().includes("representante") && repFd.parentesco) {
      titleText = `${section.title} (${repFd.parentesco})`;
    }

    doc.text(titleText, pageWidth / 2, y, { align: "center" });
    y += 5;

    if (section.section_type === "fields") {
      const fieldNames: string[] = Array.isArray(section.field_names) ? section.field_names : [];
      if (fieldNames.length === 0) continue;

      // Check if this is a "family info" section with text format (email, phone, address)
      const familyTextFields = ["family:email", "family:contact_phone", "family:address", "family:location_full"];
      const isFamilyTextSection = fieldNames.every(f => familyTextFields.includes(f));

      if (isFamilyTextSection) {
        // Render as text lines instead of table
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0);
        for (const fn of fieldNames) {
          const label = getFieldLabel(fn, planillaData);
          const value = resolveFieldValue(fn, planillaData);
          if (fn === "family:address" || fn === "family:location_full") {
            const text = `${label}: ${value}`;
            const lines = doc.splitTextToSize(text, contentWidth);
            y = ensureSpace(y, lines.length * 4.5);
            doc.text(lines, margin, y);
            y += lines.length * 4.5 + 2;
          } else {
            y = ensureSpace(y, 6);
            doc.text(`${label}: ${value}`, margin, y);
            y += 5;
          }
        }
        y += 10;
      } else {
        // Build rows of 4 columns max (label-value pairs)
        const tableHead: string[] = [];
        const tableBody: string[] = [];

        for (const fn of fieldNames) {
          tableHead.push(getFieldLabel(fn, planillaData));
          tableBody.push(resolveFieldValue(fn, planillaData));
        }

        // Split into rows of 4
        const chunkSize = 4;
        for (let i = 0; i < tableHead.length; i += chunkSize) {
          const headChunk = tableHead.slice(i, i + chunkSize);
          const bodyChunk = tableBody.slice(i, i + chunkSize);
          // Pad to chunkSize
          while (headChunk.length < chunkSize) { headChunk.push(""); bodyChunk.push(""); }

          y = ensureSpace(y, 18);
          autoTable(doc, {
            startY: y,
            head: [headChunk],
            body: [bodyChunk],
            styles: { fontSize: 9, cellPadding: 3, halign: "center", font: "helvetica" },
            headStyles: { fillColor: [41, 128, 185], fontSize: 8 },
            margin: { left: margin, right: margin },
            theme: "grid",
          });
          y = (doc as any).lastAutoTable.finalY + 3;
        }
        y += 10;
      }
    } else if (section.section_type === "text") {
      // Text block
      const text = section.section_text || "";
      if (text) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0);
        const lines = doc.splitTextToSize(text, contentWidth);
        y = ensureSpace(y, lines.length * 4.5);
        doc.text(lines, margin, y);
        y += lines.length * 4.5 + 3;
      }
      // If title contains "observaciones" add a line
      if (section.title.toLowerCase().includes("observacion")) {
        y = ensureSpace(y, 8);
        doc.setDrawColor(0);
        doc.setLineWidth(0.2);
        doc.line(margin, y, pageWidth - margin, y);
        y += 5;
      }
      y += 10;
    }
  }

  // Draw footer on last page
  drawFooter(doc);

  const safeName = studentName.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, "").trim().replace(/\s+/g, "_") || "planilla";
  doc.save(`Planilla_${safeName}.pdf`);
}
