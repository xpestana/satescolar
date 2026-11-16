// Salary receipt PDF in the layout schools already use (Artículo 106 de la LOTTT). US Letter
// portrait with everything in the top half, so the sheet can be cut to half letter.

import jsPDF from "jspdf";
import type { ReceiptRow, SalaryReceiptData } from "./salaryReceipt";

const PAGE_W = 215.9;
const HALF = 279.4 / 2;
const L = 8;
const R = PAGE_W - 8;

/** Writes text shrinking it until it fits the width (never below 5 pt). */
function fit(doc: jsPDF, text: string, x: number, y: number, maxW: number, size: number, align: "left" | "center" | "right" = "left") {
  let s = size;
  doc.setFontSize(s);
  while (s > 5 && doc.getTextWidth(text) > maxW) doc.setFontSize((s -= 0.25));
  doc.text(text, x, y, { align });
}

/** Label in bold followed by its value, both in one cell. */
function cell(doc: jsPDF, x: number, y: number, w: number, h: number, label: string, value: string, opts: { center?: boolean } = {}) {
  doc.rect(x, y, w, h);
  const mid = y + h / 2 + 1.2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  const labelW = label ? doc.getTextWidth(label) + 2 : 0;
  if (label) doc.text(label, x + 2, mid);
  doc.setFont("helvetica", "normal");
  if (opts.center && !label) fit(doc, value, x + w / 2, mid, w - 4, 7.5, "center");
  else fit(doc, value, x + 3 + labelW, mid, w - 5 - labelW, 7.5);
}

function column(doc: jsPDF, title: string, rows: ReceiptRow[], total: string, x: number, y: number, w: number, rowH: number, count: number) {
  doc.setLineWidth(0.3);
  doc.rect(x, y, w, 5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(title, x + w / 2, y + 3.6, { align: "center" });
  const bodyH = rowH * count + 2;
  doc.rect(x, y + 5, w, bodyH);
  const detailX = x + w * 0.66;
  doc.setFont("helvetica", "normal");
  rows.forEach((row, i) => {
    const ry = y + 5 + 1 + rowH * (i + 1) - 0.9;
    const labelW = (row.detail ? detailX - 3 : x + w - 22) - (x + 1.5);
    fit(doc, row.label, x + 1.5, ry, labelW, 7.3);
    if (row.detail) fit(doc, row.detail, detailX, ry, w * 0.14, 7.3, "right");
    if (row.amount) {
      doc.setFont("helvetica", row.label.toLowerCase().startsWith("total") ? "bold" : "normal");
      fit(doc, row.amount, x + w - 1.5, ry, 20, 7.3, "right");
      doc.setFont("helvetica", "normal");
    }
  });
  const ty = y + 5 + bodyH;
  doc.rect(x, ty, w, 5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("SUB TOTAL", x + w * 0.3, ty + 3.6, { align: "center" });
  doc.text(total, x + w - 1.5, ty + 3.6, { align: "right" });
  return ty + 5;
}

export function generateSalaryReceiptPdf(data: SalaryReceiptData): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  doc.setLineWidth(0.3);
  doc.setTextColor(0);

  // Header: school on the left, RIF and phone on the right.
  doc.setFont("helvetica", "bold");
  fit(doc, `"${data.schoolName}"`, L, 10, 140, 11);
  if (data.schoolRif) fit(doc, `RIF: ${data.schoolRif}`, R, 10, 55, 8.5, "right");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  if (data.schoolAddress) {
    const lines = (doc.splitTextToSize(`DIRECCIÓN FISCAL: ${data.schoolAddress}`, 125) as string[]).slice(0, 2);
    doc.text(lines, L, 14);
  }
  if (data.schoolPhone) {
    doc.setFont("helvetica", "bold");
    fit(doc, `Telf: ${data.schoolPhone}`, R, 17, 55, 8, "right");
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("RECIBO DE PAGO (Artículo 106 de la LOTTT)", PAGE_W / 2, 22, { align: "center" });
  doc.text(data.payrollLabel, PAGE_W / 2, 26.5, { align: "center" });

  // Worker and period grid.
  const c1 = 70;
  const c2 = 140;
  let y = 29;
  cell(doc, L, y, c2 - L, 7, "TRABAJADOR:", data.workerName);
  cell(doc, c2, y, R - c2, 7, "FECHA DE INGRESO:", data.hireDate);
  y += 7;
  cell(doc, L, y, c1 - L, 10, "C.I. N°", data.documentId);
  doc.rect(c1, y, c2 - c1, 10);
  doc.setFont("helvetica", "bold");
  fit(doc, data.periodRange ? `PERIODO ${data.periodRange}` : "PERIODO", (c1 + c2) / 2, y + 6.2, c2 - c1 - 4, 8, "center");
  doc.rect(c2, y, R - c2, 10);
  doc.setFontSize(7.5);
  doc.text("CARGO:", c2 + 2, y + 6.2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.3);
  const job = (doc.splitTextToSize(data.jobTitle, R - c2 - 16) as string[]).slice(0, 3);
  doc.text(job, R - 1.5, y + 5.6 - (job.length - 1) * 1.2, { align: "right", lineHeightFactor: 1.05 });
  y += 10;
  doc.setFont("helvetica", "bold");
  cell(doc, L, y, c1 - L, 7, "", data.periodName, { center: true });
  doc.setFont("helvetica", "bold");
  cell(doc, c1, y, c2 - c1, 7, "", data.bankText, { center: true });
  cell(doc, c2, y, R - c2, 7, "SALARIO MENSUAL BS.", data.monthlySalary);
  y += 10;

  // Assignments and deductions side by side; the rows shrink to keep everything in the half page.
  const count = Math.max(data.earnings.length, data.deductions.length, 4);
  const rowH = Math.min(3.8, Math.max(2.6, 44 / count));
  const colW = (R - L - 6) / 2;
  const endA = column(doc, "ASIGNACIONES", data.earnings, data.grossVes, L, y, colW, rowH, count);
  column(doc, "DEDUCCIONES", data.deductions, data.deductionsVes, L + colW + 6, y, colW, rowH, count);
  y = endA + 3;

  // "He recibido…" and the net.
  const recW = 122;
  doc.rect(L, y, recW, 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(
    [
      "HE RECIBIDO LA CANTIDAD ESPECIFICADA EN EL PRESENTE",
      "RECIBO POR CONCEPTO DE SUELDOS Y SALARIOS",
      data.periodRangeSlash ? `CORRESPONDIENTE AL PERIODO ${data.periodRangeSlash}` : "CORRESPONDIENTE AL PERIODO",
    ],
    L + recW / 2,
    y + 4,
    { align: "center", lineHeightFactor: 1.3 }
  );
  doc.rect(c2, y + 1, R - c2, 8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("TOTAL NETO", c2 + 3, y + 6.3);
  doc.text(`Bs ${data.netVes}`, R - 2, y + 6.3, { align: "right" });
  y += 13;

  // Signature of the worker.
  const signX = L + recW / 2;
  doc.setLineWidth(0.2);
  doc.line(signX - 35, y + 7, signX + 35, y + 7);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  fit(doc, data.workerName, signX, y + 10.5, 90, 8, "center");
  doc.setFont("helvetica", "normal");
  if (data.documentId) doc.text(data.documentId, signX, y + 14, { align: "center" });
  y += 16;

  // Observations, with the validity note.
  const obsH = Math.max(9, Math.min(HALF - 3 - y, 14));
  doc.setLineWidth(0.3);
  doc.rect(L, y, R - L, obsH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("OBSERVACIONES:", L + 2, y + 3.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  const note = `${data.notes ? `${data.notes} ` : ""}(Nota: No es válido si no va con sello y firma)`;
  const noteLines = (doc.splitTextToSize(note, R - L - 31) as string[]).slice(0, Math.max(1, Math.floor((obsH - 2) / 3)));
  doc.text(noteLines, L + 28, y + 3.5, { lineHeightFactor: 1.2 });

  return doc;
}

export function downloadSalaryReceiptPdf(data: SalaryReceiptData, filename: string): void {
  generateSalaryReceiptPdf(data).save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

/** The PDF as base64, to attach it to the receipt email. */
export function salaryReceiptPdfBase64(data: SalaryReceiptData): string {
  return generateSalaryReceiptPdf(data).output("datauristring").split(",")[1] ?? "";
}
