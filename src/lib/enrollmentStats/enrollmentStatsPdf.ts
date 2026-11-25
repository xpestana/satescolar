// Exportación a PDF de la Estadística de matrícula: membrete del colegio (planilla_general_config)
// y los mismos bloques que el Excel, en una cuadrícula de 3 tablas por fila.

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { triggerDownload, type PdfFooterConfig, type PdfHeaderConfig, type PdfSchoolInfo } from "@/lib/export-utils";
import {
  DEFAULT_PDF_FOOTER,
  DEFAULT_PDF_HEADER,
  PDF_MARGIN,
  drawPdfSchoolFooter,
  drawPdfSchoolHeader,
} from "@/lib/pdfSchoolBranding";
import type { EnrollmentStatsExportMeta, EnrollmentStatsSheet, ReportTable } from "./reportTables";

const TABLES_PER_ROW = 3;
const GAP = 5;
const ROW_HEIGHT = 4.6;
const FOOTER_SPACE = 22;

export interface EnrollmentStatsPdfBranding {
  schoolInfo?: PdfSchoolInfo;
  headerConfig?: PdfHeaderConfig;
  footerConfig?: PdfFooterConfig;
}

function estimateHeight(table: ReportTable): number {
  return (table.body.length + table.foot.length + 2) * ROW_HEIGHT;
}

function drawTable(doc: jsPDF, table: ReportTable, x: number, y: number, width: number): number {
  const bodyRows = table.body.length;
  autoTable(doc, {
    startY: y,
    margin: { left: x },
    tableWidth: width,
    head: [
      [{ content: table.title, colSpan: table.head.length, styles: { fillColor: [217, 210, 233], textColor: [31, 58, 147] } }],
      table.head,
    ],
    body: [...table.body, ...table.foot],
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 1, halign: "center", lineColor: [190, 190, 190] },
    headStyles: { fillColor: [237, 237, 237], textColor: 0, fontStyle: "bold" },
    columnStyles: { 0: { halign: "left" } },
    pageBreak: "avoid",
    didParseCell: (data) => {
      if (data.section !== "body" || data.row.index < bodyRows) return;
      data.cell.styles.fontStyle = "bold";
      if (data.row.index === bodyRows) data.cell.styles.fillColor = [255, 242, 204];
    },
  });
  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

/** Draws `tables` in rows of 3, adding pages as needed. Returns the last Y used. */
function drawGrid(doc: jsPDF, tables: ReportTable[], startY: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const width = (pageWidth - 2 * PDF_MARGIN - GAP * (TABLES_PER_ROW - 1)) / TABLES_PER_ROW;
  let y = startY;

  for (let i = 0; i < tables.length; i += TABLES_PER_ROW) {
    const chunk = tables.slice(i, i + TABLES_PER_ROW);
    const needed = Math.max(...chunk.map(estimateHeight));
    if (y + needed > pageHeight - FOOTER_SPACE) {
      doc.addPage();
      y = 15;
    }
    // The height check above keeps the row on one page; every table of the row starts on it.
    const page = doc.getCurrentPageInfo().pageNumber;
    const bottoms = chunk.map((table, j) => {
      doc.setPage(page);
      return drawTable(doc, table, PDF_MARGIN + j * (width + GAP), y, width);
    });
    y = Math.max(...bottoms) + GAP;
  }
  return y;
}

function drawSectionTitle(doc: jsPDF, text: string, y: number): number {
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text(text, PDF_MARGIN, y);
  doc.setFont("helvetica", "normal");
  return y + 4;
}

export async function exportEnrollmentStatsPdf(
  sheets: EnrollmentStatsSheet[],
  meta: EnrollmentStatsExportMeta,
  branding: EnrollmentStatsPdfBranding,
  filename: string,
): Promise<void> {
  const doc = new jsPDF({ orientation: "landscape" });
  const title = "Matrícula actualizada por edad, sexo y documento de identidad";
  let y = branding.schoolInfo
    ? await drawPdfSchoolHeader(doc, branding.schoolInfo, branding.headerConfig ?? DEFAULT_PDF_HEADER, title)
    : 20;

  doc.setFontSize(8);
  doc.setTextColor(60);
  doc.text(
    [meta.yearLabel && `Año escolar ${meta.yearLabel}`, meta.scopeLabel, `Fecha de actualización: ${meta.dateLabel}`]
      .filter(Boolean)
      .join("   ·   "),
    doc.internal.pageSize.getWidth() / 2,
    y - 3,
    { align: "center" },
  );
  y += 2;

  sheets
    .filter((sheet) => sheet.tables.length > 0)
    .forEach((sheet, index) => {
      if (index > 0) {
        doc.addPage();
        y = 15;
      }
      y = drawGrid(doc, sheet.tables, drawSectionTitle(doc, sheet.title, y));
    });

  const footer = branding.footerConfig ?? DEFAULT_PDF_FOOTER;
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page);
    drawPdfSchoolFooter(doc, branding.schoolInfo, footer, page);
  }

  triggerDownload(doc.output("blob"), `${filename}.pdf`);
}
