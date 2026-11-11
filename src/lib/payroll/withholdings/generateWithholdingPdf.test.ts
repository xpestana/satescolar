import { describe, expect, it } from "vitest";
import type { AnnualCertificate, VoucherData } from "./buildWithholdingVoucherData";
import { generateAnnualCertificatePdf, generateWithholdingVoucherPdf, voucherAmount } from "./generateWithholdingPdf";

const vatVoucher: VoucherData = {
  title: "Comprobante de retención de IVA",
  taxType: "vat",
  fiscalYear: "2026",
  fiscalMonth: "11",
  operation: {
    date: "02/11/2026",
    invoiceNumber: "F-0001",
    debitNoteNumber: "",
    controlNumber: "00-0001",
    transactionType: "01-Factura",
    totalVes: 1160,
    exemptVes: 0,
    baseVes: 1000,
    vatRatePct: 16,
    taxVes: 160,
    conceptCode: "—",
    ratePct: 75,
    subtrahendVes: 0,
    withheldVes: 120,
  },
  voucherNumber: "20261100000001",
  issueDate: "04/11/2026",
  deliveryDate: "—",
  fiscalPeriod: "01/11/2026 al 15/11/2026",
  agent: { name: "Colegio Uno", taxId: "J-00000000-1", address: "Valencia" },
  supplier: { name: "Servicios CA", taxId: "J-12345678-9", address: "Caracas", email: "a@example.com" },
  documentLabel: "Factura",
  documentNumber: "F-0001",
  controlNumber: "00-0001",
  documentDate: "01/11/2026",
  rows: [{ label: "Base imponible", amount: 1000 }],
  ratePct: 75,
  withheldVes: 120,
  conceptName: null,
  isVoided: false,
};

const islrVoucher: VoucherData = {
  ...vatVoucher,
  title: "Comprobante de retención de ISLR",
  taxType: "islr",
  operation: { ...vatVoucher.operation, conceptCode: "002", ratePct: 3, subtrahendVes: 107.5, withheldVes: 7898.72, baseVes: 266874 },
};

describe("withholding PDFs", () => {
  it("prints the IVA voucher with the SENIAT table", () => {
    const content = generateWithholdingVoucherPdf(vatVoucher).output();
    for (const text of [
      "20261100000001", "Colegio Uno", "J-12345678-9", "F-0001", "00-0001", "01-Factura",
      "1.160,00", "160,00", "120,00", "16,00%", "FIRMA BENEFICIARIO", "SNAT/2025/000054",
    ]) {
      expect(content).toContain(text);
    }
    // Total of the invoice twice per row: "total compra" and the last column, "total factura".
    expect(content.split("1.160,00").length - 1).toBe(4);
    expect(content).not.toContain("ANULADO");
  });

  it("prints the IVA voucher on portrait letter, using only the top half", () => {
    const doc = generateWithholdingVoucherPdf({
      ...vatVoucher,
      agent: { ...vatVoucher.agent, address: "Av. Principal de la urbanización, edificio largo, piso 3, oficina 3-B, municipio y estado ".repeat(2) },
      operation: { ...vatVoucher.operation, totalVes: 1234567.89, baseVes: 1064282.66, taxVes: 170285.23, withheldVes: 127713.92 },
    });
    expect(doc.internal.pageSize.getWidth()).toBeCloseTo(215.9, 0);
    expect(doc.internal.pageSize.getHeight()).toBeCloseTo(279.4, 0);
    expect(doc.getNumberOfPages()).toBe(1);
    const tableEnd = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
    expect(tableEnd).toBeLessThan(279.4 / 2 - 25);
  });

  it("prints the ISLR voucher with concept code, portion and subtrahend", () => {
    const content = generateWithholdingVoucherPdf(islrVoucher).output();
    for (const text of ["Decreto 1.808", "002", "266.874,00", "3,00%", "107,50", "7.898,72", "retenido", "20261100000001"]) {
      expect(content).toContain(text);
    }
  });

  it("marks a voided voucher", () => {
    expect(generateWithholdingVoucherPdf({ ...vatVoucher, isVoided: true }).output()).toContain("ANULADO");
    expect(generateWithholdingVoucherPdf({ ...islrVoucher, isVoided: true }).output()).toContain("ANULADO");
  });

  it("formats amounts like the vouchers", () => {
    expect(voucherAmount(309573.84)).toBe("309.573,84");
  });

  it("prints the yearly certificate", () => {
    const certificate: AnnualCertificate = {
      year: 2026,
      agent: { name: "Colegio Uno", taxId: "J-00000000-1" },
      worker: { name: "Ana Perez", taxId: "V-12345678-9", documentId: "V-12345678" },
      lines: [{ period: "01/11/2026", base: 10000, ratePct: 2, withheld: 200 }],
      totalBase: 10000,
      totalWithheld: 200,
    };
    const content = generateAnnualCertificatePdf(certificate).output();
    expect(content).toContain("Ana Perez");
    expect(content).toContain("V-12345678-9");
    expect(content).toContain("Total");
  });
});
