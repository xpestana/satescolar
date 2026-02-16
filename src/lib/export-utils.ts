import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface ExportColumn {
  key: string;
  label: string;
}

type RecordRow = Record<string, any>;

export interface PdfSchoolInfo {
  name: string;
  deaCode: string;
  address: string;
  state: string;
  municipality: string;
  city: string;
  parish: string;
  logoUrl?: string;
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
  schoolInfo?: PdfSchoolInfo
) {
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
    let logoX = margin;
    let textX = margin;
    if (schoolInfo.logoUrl) {
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

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(schoolInfo.name.toUpperCase(), infoX, infoY);
    infoY += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(60);
    doc.text(`Código del Plantel: ${schoolInfo.deaCode}`, infoX, infoY);
    infoY += 4;

    // Address line
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
      // Footer with page number
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(
        `Página ${data.pageNumber} de ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: "center" }
      );
    },
  });

  doc.save(`${filename}.pdf`);
}

// ── Carnet (vertical) ────────────────────────────────
export async function downloadCarnet(params: {
  personName: string;
  documentId: string;
  role: "ESTUDIANTE" | "REPRESENTANTE" | "DOCENTE";
  photoUrl?: string;
  schoolName: string;
  schoolLocation: string;
  schoolLogoUrl?: string;
  schoolYear: string;
}) {
  // Standard CR80 card: 85.6 x 53.98 mm — vertical orientation
  const w = 53.98;
  const h = 85.6;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: [w, h] });

  // ── FRONT SIDE ──

  // White background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, w, h, "F");

  // Top blue header area with diagonal geometric shapes
  doc.setFillColor(1, 5, 30); // dark blue (#01051e)
  doc.rect(0, 0, w, 28, "F");

  // Decorative diagonal accent (lighter blue triangle)
  doc.setFillColor(30, 120, 200);
  doc.triangle(0, 0, 18, 0, 0, 28, "F");

  // Another accent triangle on the right
  doc.setFillColor(50, 150, 230);
  doc.triangle(w, 0, w - 14, 0, w, 22, "F");

  // Small decorative stripe
  doc.setFillColor(30, 120, 200);
  doc.rect(0, 28, w, 1.5, "F");

  // School logo in header
  if (params.schoolLogoUrl) {
    const logoB64 = await loadImageAsBase64(params.schoolLogoUrl);
    if (logoB64) {
      try {
        doc.addImage(logoB64, "PNG", w / 2 - 5, 2, 10, 10);
      } catch { /* ignore */ }
    }
  }

  // School name in header
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(5);
  doc.setFont("helvetica", "bold");
  const nameLines = doc.splitTextToSize(params.schoolName.toUpperCase(), w - 8);
  doc.text(nameLines, w / 2, params.schoolLogoUrl ? 15 : 8, { align: "center" });

  // School location
  doc.setFontSize(3.5);
  doc.setFont("helvetica", "normal");
  doc.text(params.schoolLocation, w / 2, params.schoolLogoUrl ? 19 : 13, { align: "center" });

  // School year
  doc.setFontSize(3.5);
  doc.text(`Año Escolar: ${params.schoolYear}`, w / 2, params.schoolLogoUrl ? 22 : 16, { align: "center" });

  // ── Photo circle ──
  const photoY = 40;
  const photoR = 9;

  // White circle background behind photo
  doc.setFillColor(255, 255, 255);
  doc.circle(w / 2, photoY, photoR + 1, "F");

  // Blue border ring
  doc.setDrawColor(30, 120, 200);
  doc.setLineWidth(0.8);
  doc.circle(w / 2, photoY, photoR + 0.5);

  if (params.photoUrl) {
    const photoB64 = await loadImageAsBase64(params.photoUrl);
    if (photoB64) {
      try {
        // Create circular-cropped image via canvas
        const circularB64 = await createCircularImage(photoB64, 300);
        if (circularB64) {
          doc.addImage(circularB64, "PNG", w / 2 - photoR, photoY - photoR, photoR * 2, photoR * 2);
        }
      } catch { /* ignore */ }
    }
  }

  // ── Name ──
  doc.setTextColor(1, 5, 30);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  const personLines = doc.splitTextToSize(params.personName.toUpperCase(), w - 8);
  doc.text(personLines, w / 2, 54, { align: "center" });

  // ── Role badge ──
  doc.setFillColor(30, 120, 200);
  const badgeW = 24;
  const badgeH = 5;
  const badgeX = (w - badgeW) / 2;
  const badgeY = personLines.length > 1 ? 58 : 57;
  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(5);
  doc.setFont("helvetica", "bold");
  doc.text(params.role, w / 2, badgeY + 3.5, { align: "center" });

  // ── Document ID ──
  const idY = badgeY + badgeH + 5;
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(4);
  doc.setFont("helvetica", "normal");
  doc.text("DOCUMENTO DE IDENTIDAD", w / 2, idY, { align: "center" });
  doc.setTextColor(1, 5, 30);
  doc.setFontSize(6);
  doc.setFont("helvetica", "bold");
  doc.text(params.documentId || "Sin documento", w / 2, idY + 4, { align: "center" });

  // ── Bottom decorative bar ──
  doc.setFillColor(1, 5, 30);
  doc.rect(0, h - 4, w, 4, "F");

  // Diagonal accent on bottom
  doc.setFillColor(30, 120, 200);
  doc.triangle(w, h, w - 16, h, w, h - 4, "F");

  doc.setFillColor(50, 150, 230);
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

// ── Helper ───────────────────────────────────────────
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
