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
