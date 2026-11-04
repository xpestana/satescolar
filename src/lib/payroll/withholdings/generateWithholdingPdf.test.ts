import { describe, expect, it } from "vitest";
import type { AnnualCertificate, VoucherData } from "./buildWithholdingVoucherData";
import { generateAnnualCertificatePdf, generateWithholdingVoucherPdf } from "./generateWithholdingPdf";

const voucher: VoucherData = {
  title: "Comprobante de retención de IVA",
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

describe("withholding PDFs", () => {
  it("prints the data of the voucher", () => {
    const content = generateWithholdingVoucherPdf(voucher).output();
    for (const text of ["20261100000001", "Colegio Uno", "J-12345678-9", "F-0001", "00-0001", "Monto retenido"]) {
      expect(content).toContain(text);
    }
    expect(content).not.toContain("ANULADO");
  });

  it("marks a voided voucher", () => {
    expect(generateWithholdingVoucherPdf({ ...voucher, isVoided: true }).output()).toContain("ANULADO");
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
