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

/**
 * A bordered field: small bold label on top, value below. A value that doesn't fit (a long email
 * or address) shrinks until it does, so nothing spills out of the box.
 */
function box(doc: jsPDF, x: number, y: number, w: number, h: number, label: string, value: string) {
  doc.setDrawColor(0);
  doc.rect(x, y, w, h);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.8);
  doc.text(label, x + w / 2, y + 2.6, { align: "center" });
  doc.setFont("helvetica", "normal");
  const maxWidth = w - 2.4;
  const firstLine = (size: number) => y + 3.4 + size * 0.3528;
  let size = 7.5;
  let lines: string[] = [];
  for (; size >= 5; size -= 0.5) {
    doc.setFontSize(size);
    lines = doc.splitTextToSize(value, maxWidth) as string[];
    const lineHeight = size * 0.3528 * 1.15;
    const fitsWide = lines.every((line) => doc.getTextWidth(line) <= maxWidth);
    const fitsTall = firstLine(size) + (lines.length - 1) * lineHeight <= y + h - 0.9;
    if (fitsWide && fitsTall) break;
  }
  doc.setFontSize(Math.max(size, 5));
  doc.text(lines, x + 1.2, firstLine(Math.max(size, 5)), { lineHeightFactor: 1.15 });
}

// US Letter portrait. Everything stays in the top half so the sheet can be cut in two (half
// letter), while the PDF still shows the whole page.
const LETTER_WIDTH = 215.9;
const HALF_LETTER = 279.4 / 2;

function generateVatVoucherPdf(data: VoucherData): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const op = data.operation;
  const left = 8;
  const right = LETTER_WIDTH - 8;
  const gap = 2;
  // Three columns for the boxes: name, RIF and a narrow one on the right.
  const col3 = { x: right - 42, w: 42 };
  const col2 = { x: col3.x - gap - 42, w: 42 };
  const col1 = { x: left, w: col2.x - gap - left };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(
    doc.splitTextToSize("COMPROBANTE DE RETENCIÓN DE IMPUESTO AL VALOR AGREGADO (IVA)", col1.w - 6) as string[],
    left,
    10
  );
  box(doc, col2.x, 6, col2.w, 9, "FECHA EMISIÓN", data.issueDate);
  box(doc, col3.x, 6, col3.w, 9, "N° COMPROBANTE", data.voucherNumber);
  voidedMark(doc, data, right, 19.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);
  doc.text(
    doc.splitTextToSize(
      "Comprobante de retención del Impuesto al Valor Agregado emitido conforme al artículo 11 de la Ley que establece el " +
        "Impuesto al Valor Agregado, que faculta a la Administración Tributaria a designar como responsables del pago del " +
        "impuesto, en calidad de agentes de retención, a quienes por sus funciones públicas o por razón de sus actividades " +
        "privadas intervengan en operaciones gravadas con el impuesto.",
      right - left - 22
    ) as string[],
    left,
    19
  );

  const wide = col2.x + col2.w - left;
  box(doc, col1.x, 26, col1.w, 9, "NOMBRE O RAZÓN SOCIAL AGENTE DE RETENCIÓN", data.agent.name);
  box(doc, col2.x, 26, col2.w, 9, "RIF DEL AGENTE DE RETENCIÓN", data.agent.taxId);
  box(doc, col3.x, 26, col3.w, 9, "PERÍODO FISCAL", `AÑO ${data.fiscalYear}     MES ${data.fiscalMonth}`);
  box(doc, left, 36.5, wide, 10.5, "DIRECCIÓN FISCAL DEL AGENTE DE RETENCIÓN", data.agent.address);
  box(doc, col1.x, 48.5, col1.w, 9, "NOMBRE O RAZÓN SOCIAL DEL SUJETO RETENIDO", data.supplier.name);
  box(doc, col2.x, 48.5, col2.w, 9, "RIF DEL SUJETO RETENIDO", data.supplier.taxId);
  box(doc, col3.x, 48.5, col3.w, 9, "CORREO ELECTRÓNICO", data.supplier.email === "—" ? "" : data.supplier.email);
  box(doc, left, 59, wide, 10.5, "DIRECCIÓN FISCAL DEL SUJETO RETENIDO", data.supplier.address);

  // Fixed widths (they add up to the 199.9 mm between the margins) so the 15 SENIAT columns fit.
  const widths = [7, 13.5, 13.5, 14.5, 10.5, 10.5, 17, 12, 15.5, 14, 15.5, 11.5, 14.5, 14.5, 15.9];
  autoTable(doc, {
    startY: 72,
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
    styles: { fontSize: 6, cellPadding: 0.8, lineColor: 0, lineWidth: 0.2, textColor: 0, valign: "middle", overflow: "linebreak" },
    headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: "bold", halign: "center", fontSize: 5.3 },
    footStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: "bold" },
    columnStyles: Object.fromEntries(
      widths.map((cellWidth, i) => [i, { cellWidth, ...(i >= 8 ? { halign: "right" as const } : {}) }])
    ),
    margin: { left, right: LETTER_WIDTH - right },
  });

  // Signatures and the legal note close the half page, whatever the table's height.
  const signY = Math.min(Math.max(lastTableY(doc, 100) + 20, 116), HALF_LETTER - 18);
  const leftSign = (left + 10 + 95) / 2;
  const rightSign = (120 + right - 10) / 2;
  doc.line(left + 10, signY, 95, signY);
  doc.line(120, signY, right - 10, signY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("FIRMA BENEFICIARIO", leftSign, signY + 3.5, { align: "center" });
  doc.text("FIRMA Y SELLO DEL AGENTE DE RETENCIÓN", rightSign, signY + 3.5, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);
  doc.text(
    "Este comprobante se emite conforme a lo indicado en el artículo 16 de la Providencia Administrativa N° SNAT/2025/000054.",
    left,
    HALF_LETTER - 6
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
