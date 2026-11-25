/**
 * Institutional header and footer of the school PDF reports (Búsqueda avanzada, Estadística de
 * matrícula, …). Extracted from `downloadPDF` so every report prints the same letterhead and
 * honours the same `planilla_general_config` toggles.
 */
import type jsPDF from "jspdf";
import { resolveImageToPngDataUrl } from "@/lib/image-resolve";
import type { PdfFooterConfig, PdfHeaderConfig, PdfSchoolInfo } from "@/lib/export-utils";

export const DEFAULT_PDF_HEADER: PdfHeaderConfig = {
  show_logo: true, show_name: true, show_dea_code: true,
  show_statistical_code: true, show_address: true, show_phone: true, show_rif: true,
};

export const DEFAULT_PDF_FOOTER: PdfFooterConfig = {
  show_address: true, show_phone: true, show_rif: true,
};

export const PDF_MARGIN = 14;

const INSTITUTION_PREFIX: Record<string, string> = {
  public: "Unidad Educativa",
  private: "Unidad Educativa Privada",
  subsidized: "Unidad Educativa Subvencionada",
};

interface NamedRef {
  name?: string | null;
}

/** Row of `schools` with its geo joins, as fetched for exports. */
export interface SchoolExportRow {
  name: string;
  dea_code: string | null;
  statistical_code?: string | null;
  address: string | null;
  logo_url?: string | null;
  institution_type?: string | null;
  phone?: string | null;
  rif?: string | null;
  states?: NamedRef | null;
  municipalities?: NamedRef | null;
  cities?: NamedRef | null;
  parishes?: NamedRef | null;
}

export function toPdfSchoolInfo(school: SchoolExportRow): PdfSchoolInfo {
  const prefix = INSTITUTION_PREFIX[school.institution_type ?? ""] ?? "Unidad Educativa";
  return {
    name: `${prefix} ${school.name}`,
    deaCode: school.dea_code ?? "",
    statisticalCode: school.statistical_code ?? undefined,
    address: school.address ?? "",
    phone: school.phone ?? undefined,
    rif: school.rif ?? undefined,
    state: school.states?.name ?? "",
    municipality: school.municipalities?.name ?? "",
    city: school.cities?.name ?? "",
    parish: school.parishes?.name ?? "",
    logoUrl: school.logo_url || undefined,
  };
}

/** Draws the letterhead and the centered title. Returns the Y where content can start. */
export async function drawPdfSchoolHeader(
  doc: jsPDF,
  schoolInfo: PdfSchoolInfo,
  headerConfig: PdfHeaderConfig,
  title: string,
): Promise<number> {
  const hc = headerConfig;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = PDF_MARGIN;
  const startY = 15;

  const now = new Date();
  const dateStr = `Fecha de emisión: ${now.toLocaleDateString("es-VE", {
    year: "numeric", month: "2-digit", day: "2-digit",
  })} ${now.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })}`;

  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(dateStr, pageWidth - margin, startY, { align: "right" });

  let infoX = margin;
  if (hc.show_logo !== false && schoolInfo.logoUrl) {
    const logoBase64 = await resolveImageToPngDataUrl(schoolInfo.logoUrl);
    if (logoBase64) {
      doc.addImage(logoBase64, "PNG", margin, startY + 2, 22, 22);
      infoX = margin + 26;
    }
  }

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

  const codeParts: string[] = [];
  if (hc.show_dea_code !== false) codeParts.push(`Código DEA: ${schoolInfo.deaCode}`);
  if (hc.show_statistical_code !== false && schoolInfo.statisticalCode) codeParts.push(`Código Estadístico: ${schoolInfo.statisticalCode}`);
  if (codeParts.length > 0) {
    doc.text(codeParts.join("  -  "), infoX, infoY);
    infoY += 4;
  }

  if (hc.show_rif !== false && schoolInfo.rif) {
    doc.text(`RIF: ${schoolInfo.rif}`, infoX, infoY);
    infoY += 4;
  }

  if (hc.show_address !== false) {
    const addressParts = [schoolInfo.address];
    if (schoolInfo.parish) addressParts.push(`Parroquia: ${schoolInfo.parish}`);
    if (schoolInfo.municipality) addressParts.push(`Municipio: ${schoolInfo.municipality}`);
    if (schoolInfo.city) addressParts.push(`Ciudad: ${schoolInfo.city}`);
    if (schoolInfo.state) addressParts.push(`Estado: ${schoolInfo.state}`);
    const addressLines = doc.splitTextToSize(addressParts.filter(Boolean).join("   "), pageWidth - infoX - margin);
    doc.text(addressLines, infoX, infoY);
    infoY += addressLines.length * 4;
  }

  if (hc.show_phone !== false && schoolInfo.phone) {
    doc.text(`Tel: ${schoolInfo.phone}`, infoX, infoY);
    infoY += 4;
  }

  infoY += 2;
  doc.setDrawColor(41, 128, 185);
  doc.setLineWidth(0.5);
  doc.line(margin, infoY, pageWidth - margin, infoY);

  const titleY = infoY + 6;
  doc.setFontSize(11);
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.text(title, pageWidth / 2, titleY, { align: "center" });
  doc.setFont("helvetica", "normal");
  return titleY + 8;
}

/** School footer line plus "Página X de Y". Call it from autoTable's `didDrawPage`. */
export function drawPdfSchoolFooter(
  doc: jsPDF,
  schoolInfo: PdfSchoolInfo | undefined,
  footerConfig: PdfFooterConfig,
  pageNumber: number,
): void {
  const fc = footerConfig;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageCount = doc.getNumberOfPages();

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

  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text(`Página ${pageNumber} de ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: "center" });
}
