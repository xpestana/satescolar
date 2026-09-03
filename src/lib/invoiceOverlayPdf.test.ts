import { describe, it, expect } from "vitest";
import { buildInvoiceOverlayPdf, invoiceOverlayPdfName } from "./invoiceOverlayPdf";
import { printableOverlayFields } from "./invoiceFieldValue";
import type { InvoiceTemplate } from "@/pages/school/InvoiceTemplateConfig";

const template = (over: Partial<InvoiceTemplate> = {}): InvoiceTemplate => ({
  id: "t1",
  school_id: "s1",
  name: "Factura MLK",
  description: null,
  paper_width_mm: 216,
  paper_height_mm: 140,
  background_url: null,
  is_active: true,
  fields: [
    { key: "invoice_number", x_mm: 30, y_mm: 20, width_mm: 40, font_size_pt: 10, bold: true },
    { key: "student_name_1", x_mm: 20, y_mm: 40, width_mm: 80, font_size_pt: 9 },
    { key: "student_name_2", x_mm: 20, y_mm: 46, width_mm: 80, font_size_pt: 9 },
  ],
  ...over,
} as InvoiceTemplate);

const data = {
  invoice_number: "016725",
  student_name_1: "Ana González",
  // student_name_2 vacío a propósito: no debe imprimirse
};

describe("buildInvoiceOverlayPdf", () => {
  it("usa el tamaño de papel de la plantilla, no el del sistema", () => {
    const doc = buildInvoiceOverlayPdf(template(), data);
    expect(doc.internal.pageSize.getWidth()).toBeCloseTo(216, 1);
    expect(doc.internal.pageSize.getHeight()).toBeCloseTo(140, 1);
  });

  it("respeta la orientación implícita en las medidas", () => {
    const vertical = buildInvoiceOverlayPdf(template({ paper_width_mm: 140, paper_height_mm: 216 }), data);
    expect(vertical.internal.pageSize.getWidth()).toBeCloseTo(140, 1);
    expect(vertical.internal.pageSize.getHeight()).toBeCloseTo(216, 1);
  });

  it("imprime solo los campos con valor, igual que el overlay HTML", () => {
    const printable = printableOverlayFields(template().fields, data);
    expect(printable.map((f) => f.key)).toEqual(["invoice_number", "student_name_1"]);
  });

  it("genera una sola página", () => {
    expect(buildInvoiceOverlayPdf(template(), data).getNumberOfPages()).toBe(1);
  });

  it("no falla con una plantilla sin campos", () => {
    expect(() => buildInvoiceOverlayPdf(template({ fields: [] }), data)).not.toThrow();
  });

  it("nombra el archivo con el número de factura", () => {
    expect(invoiceOverlayPdfName({ invoice_number: "016725" })).toBe("factura_016725.pdf");
    expect(invoiceOverlayPdfName({})).toBe("factura_sin-numero.pdf");
  });
});
