// Client-side payroll receipt PDF using jsPDF + autotable. Consumes the tested
// buildPayrollReceiptData output so all formatting lives in one tested place.

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { PayrollReceiptData } from "./buildPayrollReceiptData";

export function generatePayrollReceiptPdf(data: PayrollReceiptData): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const marginX = 15;
  let y = 18;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(data.schoolName, marginX, y);

  y += 7;
  doc.setFontSize(12);
  doc.text("Recibo de Pago de Nómina", marginX, y);

  y += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const infoLines = [
    `Beneficiario: ${data.beneficiaryName}`,
    `Cédula/RIF: ${data.documentId}`,
    `Categoría: ${data.categoryLabel}`,
    `Período: ${data.periodName} (${data.periodRange})`,
    `Método de pago: ${data.methodLabel}`,
    `Fecha de pago: ${data.paymentDateFormatted}`,
    `Referencia: ${data.paymentReference}`,
  ];
  infoLines.forEach((line) => {
    doc.text(line, marginX, y);
    y += 5.5;
  });

  y += 2;
  // Payments in dollars show each line in bolívares too: that is what adds up to the transfer.
  const isUsd = data.currency !== "VES";
  const row = (line: { description: string; amountFormatted: string; amountVesFormatted: string }, kind: string) =>
    isUsd ? [line.description, kind, line.amountFormatted, line.amountVesFormatted] : [line.description, kind, line.amountFormatted];
  autoTable(doc, {
    startY: y,
    head: [isUsd ? ["Concepto", "Tipo", `Monto (${data.currency})`, "Monto (VES)"] : ["Concepto", "Tipo", `Monto (${data.currency})`]],
    body: [
      ...data.earnings.map((e) => row(e, "Asignación")),
      ...data.deductions.map((d) => row(d, "Deducción")),
    ],
    theme: "striped",
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 9 },
    margin: { left: marginX, right: marginX },
  });

  // jspdf-autotable stores the final Y on the doc instance.
  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20;
  let ty = finalY + 8;
  doc.setFontSize(10);
  const totals = [
    ["Total asignaciones", data.grossFormatted],
    ["Total deducciones", data.deductionsFormatted],
    ["Neto a pagar", data.netFormatted],
  ];
  totals.forEach(([label, value]) => {
    doc.text(`${label}:`, marginX, ty);
    doc.text(value, 120, ty);
    ty += 6;
  });

  if (data.currency !== "VES") {
    doc.text(`Tasa aplicada: ${data.exchangeRateFormatted} VES/USD`, marginX, ty);
    ty += 6;
    doc.text("Asignaciones en VES:", marginX, ty);
    doc.text(data.grossVesFormatted, 120, ty);
    ty += 6;
    doc.text("Deducciones en VES:", marginX, ty);
    doc.text(data.deductionsVesFormatted, 120, ty);
    ty += 6;
    doc.setFont("helvetica", "bold");
    doc.text("Equivalente en VES:", marginX, ty);
    doc.text(data.netVesFormatted, 120, ty);
    doc.setFont("helvetica", "normal");
    ty += 6;
  }

  if (data.notes) {
    ty += 4;
    doc.setFontSize(9);
    doc.text(`Observaciones: ${data.notes}`, marginX, ty, { maxWidth: 180 });
  }

  return doc;
}

/** Build the receipt and trigger a browser download. */
export function downloadPayrollReceiptPdf(data: PayrollReceiptData, filename: string): void {
  const doc = generatePayrollReceiptPdf(data);
  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
