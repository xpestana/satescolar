// PDF of the withholding vouchers and of the yearly certificate (ARC). The IVA voucher follows the
// SENIAT table layout and the ISLR voucher the one schools already hand out, so the accountant
// sees the same columns as on their current vouchers.

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatMoney } from "../buildPayrollReceiptData";
import type { AnnualCertificate, VoucherData } from "./buildWithholdingVoucherData";

const MARGIN_X = 15;

function lastTableY(doc: jsPDF, fallback: number): number {
  return (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? fallback;
}

/** Amounts as printed on the vouchers: 157.515,67 (no currency prefix). */
export function voucherAmount(value: number): string {
  return (Number.isFinite(value) ? value : 0).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const pct = (value: number) => `${voucherAmount(value)}%`;

function voidedMark(doc: jsPDF, data: VoucherData, x: number, y: number) {
  if (!data.isVoided) return;
  doc.setTextColor(200, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("ANULADO", x, y, { align: "right" });
  doc.setTextColor(0, 0, 0);
}

/** A bordered field: small bold label on top, value below. */
function box(doc: jsPDF, x: number, y: number, w: number, h: number, label: string, value: string) {
  doc.setDrawColor(0);
  doc.rect(x, y, w, h);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text(label, x + w / 2, y + 3.8, { align: "center" });
  doc.setFont("helvetica", "normal");
  // A long single word (an email) can't wrap: it shrinks to fit the box instead.
  let size = 8.5;
  doc.setFontSize(size);
  if (!/\s/.test(value)) {
    while (size > 5.5 && doc.getTextWidth(value) > w - 3) doc.setFontSize((size -= 0.5));
  }
  doc.text(doc.splitTextToSize(value, w - 3) as string[], x + 1.5, y + 8.2);
}

function generateVatVoucherPdf(data: VoucherData): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const op = data.operation;
  const left = 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("COMPROBANTE DE RETENCIÓN DE IMPUESTO AL VALOR AGREGADO (IVA)", left + 22, 16);
  box(doc, 200, 9, 34, 13, "FECHA EMISIÓN", data.issueDate);
  box(doc, 240, 9, 47, 13, "N° COMPROBANTE", data.voucherNumber);
  voidedMark(doc, data, 287, 28);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.text(
    doc.splitTextToSize(
      "Comprobante de retención del Impuesto al Valor Agregado emitido conforme al artículo 11 de la Ley que establece el " +
        "Impuesto al Valor Agregado, que faculta a la Administración Tributaria a designar como responsables del pago del " +
        "impuesto, en calidad de agentes de retención, a quienes por sus funciones públicas o por razón de sus actividades " +
        "privadas intervengan en operaciones gravadas con el impuesto.",
      185
    ) as string[],
    left,
    27
  );

  box(doc, left, 36, 150, 11, "NOMBRE O RAZÓN SOCIAL AGENTE DE RETENCIÓN", data.agent.name);
  box(doc, 170, 36, 64, 11, "RIF DEL AGENTE DE RETENCIÓN", data.agent.taxId);
  box(doc, 240, 36, 47, 11, "PERÍODO FISCAL", `AÑO ${data.fiscalYear}     MES ${data.fiscalMonth}`);
  box(doc, left, 49, 224, 11, "DIRECCIÓN FISCAL DEL AGENTE DE RETENCIÓN", data.agent.address);
  box(doc, left, 62, 150, 11, "NOMBRE O RAZÓN SOCIAL DEL SUJETO RETENIDO", data.supplier.name);
  box(doc, 170, 62, 64, 11, "RIF DEL SUJETO RETENIDO", data.supplier.taxId);
  box(doc, 240, 62, 47, 11, "CORREO ELECTRÓNICO", data.supplier.email === "—" ? "" : data.supplier.email);
  box(doc, left, 75, 224, 11, "DIRECCIÓN FISCAL DEL SUJETO RETENIDO", data.supplier.address);

  autoTable(doc, {
    startY: 92,
    head: [[
      "OPER N°",
      "FECHA DE LA FACTURA",
      "N° DE FACTURA",
      "N° CONTROL FACTURA",
      "N° NOTA DÉBITO",
      "N° NOTA CRÉDITO",
      "TIPO DE TRANSACCIÓN",
      "N° FACTURA AFECTADA",
      "TOTAL COMPRA INCLUYENDO IVA",
      "COMPRAS SIN DERECHO A CRÉDITO FISCAL",
      "BASE IMPONIBLE",
      "% ALÍCUOTA",
      "IMPUESTO IVA",
      "IVA RETENIDO",
      "TOTAL FACTURA",
    ]],
    body: [[
      "1",
      op.date,
      op.invoiceNumber,
      op.controlNumber,
      op.debitNoteNumber,
      "",
      op.transactionType,
      "",
      voucherAmount(op.totalVes),
      voucherAmount(op.exemptVes),
      voucherAmount(op.baseVes),
      pct(op.vatRatePct),
      voucherAmount(op.taxVes),
      voucherAmount(op.withheldVes),
      voucherAmount(op.totalVes),
    ]],
    foot: [["", "Total", "", "", "", "", "", "", voucherAmount(op.totalVes), voucherAmount(op.exemptVes), voucherAmount(op.baseVes), "", voucherAmount(op.taxVes), voucherAmount(op.withheldVes), voucherAmount(op.totalVes)]],
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 1.2, lineColor: 0, lineWidth: 0.2, textColor: 0, valign: "middle" },
    headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: "bold", halign: "center", fontSize: 6.5 },
    footStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: "bold" },
    columnStyles: Object.fromEntries([8, 9, 10, 11, 12, 13, 14].map((i) => [i, { halign: "right" }])),
    margin: { left, right: 10 },
  });

  const signY = Math.max(lastTableY(doc, 120) + 38, 165);
  doc.line(left + 15, signY, 110, signY);
  doc.line(190, signY, 280, signY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("FIRMA BENEFICIARIO", 67, signY + 4, { align: "center" });
  doc.text("FIRMA Y SELLO DEL AGENTE DE RETENCIÓN", 235, signY + 4, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.text(
    "Este comprobante se emite conforme a lo indicado en el artículo 16 de la Providencia Administrativa N° SNAT/2025/000054.",
    left,
    200
  );
  return doc;
}

function generateIslrVoucherPdf(data: VoucherData): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const op = data.operation;
  const center = 105;
  let y = 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(data.agent.name, center, y, { align: "center" });
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.text(data.agent.taxId, center, y, { align: "center" });
  y += 7;
  const title = "Comprobante de retención de Impuesto Sobre la Renta (ISLR)";
  doc.text(title, center, y, { align: "center" });
  const titleWidth = doc.getTextWidth(title);
  doc.line(center - titleWidth / 2, y + 1, center + titleWidth / 2, y + 1);
  voidedMark(doc, data, 195, 20);

  y += 7;
  doc.setFontSize(7.5);
  doc.text(
    "En cumplimiento con lo establecido en el Artículo 24 del Decreto 1.808, en materia de Retenciones ISLR, publicado en G.O. N° 36.203 del 12 de mayo de 1997.",
    center,
    y,
    { align: "center", maxWidth: 185 }
  );

  y += 12;
  doc.setFontSize(8);
  const sectionTitle = (text: string, at: number) => {
    doc.setFont("helvetica", "normal");
    doc.text(text, MARGIN_X, at);
    doc.line(MARGIN_X, at + 0.8, MARGIN_X + doc.getTextWidth(text), at + 0.8);
  };
  const field = (label: string, value: string, at: number): number => {
    doc.setFont("helvetica", "bold");
    doc.text(label, MARGIN_X, at);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(value, 175) as string[];
    doc.text(lines, MARGIN_X, at + 4);
    return at + 4 + lines.length * 4;
  };

  sectionTitle("Datos del agente de retención", y);
  doc.setFont("helvetica", "bold");
  doc.text("Fecha de emisión", 195, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text(data.issueDate, 195, y + 4, { align: "right" });
  doc.setFont("helvetica", "bold");
  if (data.voucherNumber !== "—") doc.text("N° de comprobante", 195, y + 9, { align: "right" });
  doc.setFont("helvetica", "normal");
  if (data.voucherNumber !== "—") doc.text(data.voucherNumber, 195, y + 13, { align: "right" });

  y = field("Nombre o razón", data.agent.name, y + 4);
  y = field("RIF", data.agent.taxId, y);
  y = field("Dirección", data.agent.address, y);

  y += 8;
  sectionTitle("Datos del sujeto retenido", y);
  y = field("Nombre o razón", data.supplier.name, y + 4);
  y = field("RIF", data.supplier.taxId, y);
  y = field("Dirección", data.supplier.address === "—" ? "" : data.supplier.address, y);
  y = field("Correo electrónico", data.supplier.email === "—" ? "" : data.supplier.email, y);

  const documentNumber = op.invoiceNumber || op.debitNoteNumber;
  autoTable(doc, {
    startY: y + 6,
    head: [["Fecha", "N° de factura", "N° de control", "Monto del documento", "Concepto del pago", "Base imponible", "Porción %", "Sustraendo", "Monto retenido"]],
    body: [[
      data.issueDate,
      documentNumber,
      op.controlNumber,
      voucherAmount(op.totalVes),
      op.conceptCode,
      voucherAmount(op.baseVes),
      pct(op.ratePct),
      op.subtrahendVes > 0 ? voucherAmount(op.subtrahendVes) : "",
      voucherAmount(op.withheldVes),
    ]],
    foot: [["", "", "Total", voucherAmount(op.totalVes), "", voucherAmount(op.baseVes), "", "", voucherAmount(op.withheldVes)]],
    theme: "plain",
    styles: { fontSize: 7.5, cellPadding: 1.2, textColor: 0, halign: "center" },
    headStyles: { fontStyle: "bold" },
    footStyles: { fontStyle: "bold" },
    columnStyles: Object.fromEntries([3, 5, 7, 8].map((i) => [i, { halign: "right" }])),
    margin: { left: MARGIN_X, right: MARGIN_X },
  });

  const signY = Math.max(lastTableY(doc, 150) + 55, 215);
  doc.line(55, signY, 155, signY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("FIRMA Y SELLO DEL AGENTE DE RETENCIÓN", center, signY + 4, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.text(`RIF ${data.agent.taxId}`, center, signY + 8, { align: "center" });
  return doc;
}

export function generateWithholdingVoucherPdf(data: VoucherData): jsPDF {
  return data.taxType === "vat" ? generateVatVoucherPdf(data) : generateIslrVoucherPdf(data);
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
