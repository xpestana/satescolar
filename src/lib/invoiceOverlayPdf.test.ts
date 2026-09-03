import { describe, it, expect } from "vitest";
import { MIN_FIT_FONT_PT, buildInvoiceOverlayPdf, fitTextToField, invoiceOverlayPdfName } from "./invoiceOverlayPdf";
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

  it("no deja que un texto largo se salga de su campo", () => {
    const doc = buildInvoiceOverlayPdf(
      template({
        fields: [{ key: "student_name", x_mm: 20, y_mm: 40, width_mm: 40, font_size_pt: 9 }],
      } as Partial<InvoiceTemplate>),
      { student_name: "SARA BEATRIZ LEAL ALBORNOZ / MILLY ANDREA LEAL ALBORNOZ / JUAN ANDRES LEAL ALBORNOZ" },
    );
    // La letra queda por debajo de la configurada porque hubo que achicarla para que quepa
    expect(doc.getFontSize()).toBeLessThan(9);
  });

  it("nombra el archivo con el número de factura", () => {
    expect(invoiceOverlayPdfName({ invoice_number: "016725" })).toBe("factura_016725.pdf");
    expect(invoiceOverlayPdfName({})).toBe("factura_sin-numero.pdf");
  });
});

describe("fitTextToField", () => {
  // Medida ficticia y predecible: 0,5 mm de ancho por carácter y punto de fuente
  const measure = (text: string, fontSizePt: number) => text.length * fontSizePt * 0.5;

  it("deja el texto igual cuando cabe", () => {
    const fitted = fitTextToField(measure, "016725", 40, 10);
    expect(fitted).toEqual({ text: "016725", fontSizePt: 10, adjusted: false });
  });

  it("achica la letra hasta que quepa, sin recortar el texto", () => {
    const fitted = fitTextToField(measure, "ANA / LUIS", 40, 10);
    expect(fitted.adjusted).toBe(true);
    expect(fitted.fontSizePt).toBeLessThan(10);
    expect(measure(fitted.text, fitted.fontSizePt)).toBeLessThanOrEqual(40);
    // El texto completo se conserva: solo cambió el tamaño de la letra
    expect(fitted.text).toBe("ANA / LUIS");
  });

  it("recorta con puntos suspensivos si ni al mínimo cabe", () => {
    const fitted = fitTextToField(measure, "X".repeat(200), 20, 10);
    expect(fitted.fontSizePt).toBe(MIN_FIT_FONT_PT);
    expect(fitted.text.endsWith("…")).toBe(true);
    expect(measure(fitted.text, fitted.fontSizePt)).toBeLessThanOrEqual(20);
  });

  it("no toca nada si el campo no declara ancho", () => {
    expect(fitTextToField(measure, "texto largo", 0, 9).adjusted).toBe(false);
  });
});
