// PDF of the withholding voucher and of the yearly certificate (ARC). Provisional layout, with
// the fields of art. 18 of Providencia SNAT/2026/00093, until we see the school's current voucher.

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatMoney } from "../buildPayrollReceiptData";
import type { AnnualCertificate, VoucherData } from "./buildWithholdingVoucherData";

const MARGIN_X = 15;

function lastTableY(doc: jsPDF, fallback: number): number {
  return (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? fallback;
}

export function generateWithholdingVoucherPdf(data: VoucherData): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let y = 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(data.title, MARGIN_X, y);
  y += 7;
  doc.setFontSize(10);
  doc.text(`N° ${data.voucherNumber}`, MARGIN_X, y);
  if (data.isVoided) {
    doc.setTextColor(200, 0, 0);
    doc.text("ANULADO", 195, y, { align: "right" });
    doc.setTextColor(0, 0, 0);
  }
  y += 7;

  doc.setFont("helvetica", "normal");
  [
    `Fecha de emisión: ${data.issueDate}`,
    `Fecha de entrega: ${data.deliveryDate}`,
    `Período de imposición: ${data.fiscalPeriod}`,
  ].forEach((line) => {
    doc.text(line, MARGIN_X, y);
    y += 5.5;
  });

  autoTable(doc, {
    startY: y + 2,
    head: [["Agente de retención", "Proveedor"]],
    body: [
      [data.agent.name, data.supplier.name],
      [`RIF: ${data.agent.taxId}`, `RIF: ${data.supplier.taxId}`],
      [`Domicilio fiscal: ${data.agent.address}`, `Domicilio fiscal: ${data.supplier.address}`],
      ["", `Correo: ${data.supplier.email}`],
    ],
    theme: "grid",
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 9 },
    margin: { left: MARGIN_X, right: MARGIN_X },
  });

  autoTable(doc, {
    startY: lastTableY(doc, y + 30) + 6,
    head: [[data.documentLabel, "N° de control", "Fecha"]],
    body: [[data.documentNumber, data.controlNumber, data.documentDate]],
    theme: "grid",
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 9 },
    margin: { left: MARGIN_X, right: MARGIN_X },
  });

  autoTable(doc, {
    startY: lastTableY(doc, y + 60) + 6,
    head: [["Concepto", "Monto"]],
    body: [
      ...(data.conceptName ? [["Tipo de pago", data.conceptName]] : []),
      ...data.rows.map((r) => [r.label, formatMoney(r.amount, "VES")]),
      ["Porcentaje de retención", `${data.ratePct} %`],
      ["Monto retenido", formatMoney(data.withheldVes, "VES")],
    ],
    theme: "striped",
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 9 },
    columnStyles: { 1: { halign: "right" } },
    margin: { left: MARGIN_X, right: MARGIN_X },
  });

  const signY = lastTableY(doc, 200) + 25;
  doc.line(MARGIN_X, signY, 85, signY);
  doc.line(115, signY, 185, signY);
  doc.setFontSize(9);
  doc.text("Agente de retención", MARGIN_X, signY + 5);
  doc.text("Recibido por el proveedor", 115, signY + 5);

  return doc;
}

export function generateAnnualCertificatePdf(data: AnnualCertificate): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let y = 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`Comprobante anual de retenciones de ISLR ${data.year}`, MARGIN_X, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  [
    `Agente de retención: ${data.agent.name} — RIF ${data.agent.taxId}`,
    `Trabajador: ${data.worker.name}`,
    `Cédula: ${data.worker.documentId} — RIF ${data.worker.taxId}`,
  ].forEach((line) => {
    doc.text(line, MARGIN_X, y);
    y += 5.5;
  });

  autoTable(doc, {
    startY: y + 2,
    head: [["Mes", "Monto sujeto", "% AR-I", "ISLR retenido"]],
    body: data.lines.map((l) => [l.period, formatMoney(l.base, "VES"), `${l.ratePct} %`, formatMoney(l.withheld, "VES")]),
    foot: [["Total", formatMoney(data.totalBase, "VES"), "", formatMoney(data.totalWithheld, "VES")]],
    theme: "striped",
    headStyles: { fillColor: [37, 99, 235] },
    footStyles: { fillColor: [229, 231, 235], textColor: 20 },
    styles: { fontSize: 9 },
    columnStyles: { 1: { halign: "right" }, 3: { halign: "right" } },
    margin: { left: MARGIN_X, right: MARGIN_X },
  });

  return doc;
}
