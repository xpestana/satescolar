import jsPDF from "jspdf";
import type { InvoiceTemplate, OverlayField } from "@/pages/school/InvoiceTemplateConfig";
import { printableOverlayFields, resolveOverlayValue } from "@/lib/invoiceFieldValue";

/**
 * Factura del formato preimpreso como **PDF del tamaño exacto de la plantilla**.
 *
 * La ventana HTML de `printInvoiceOverlay` declara `@page size` en milímetros, pero el driver de
 * la impresora suele imponer su propio papel: el resultado sale rotado y reescalado (la vista
 * previa del sistema muestra el texto de lado y diminuto). Un PDF lleva el tamaño de página
 * dentro del archivo, así que el visor y el driver lo respetan y el overlay **calza** sobre la
 * factura física.
 *
 * Las coordenadas son las mismas de la plantilla (`x_mm`, `y_mm`, `font_size_pt`, `bold`), y el
 * texto se ancla arriba a la izquierda, igual que el `div` absoluto del overlay HTML.
 */

/** Orientación implícita en las medidas del papel configurado. */
const orientationOf = (template: InvoiceTemplate) =>
  template.paper_width_mm > template.paper_height_mm ? "landscape" : "portrait";

export function buildInvoiceOverlayPdf(
  template: InvoiceTemplate,
  paymentData: Record<string, string>,
): jsPDF {
  const doc = new jsPDF({
    unit: "mm",
    format: [template.paper_width_mm, template.paper_height_mm],
    orientation: orientationOf(template),
    compress: true,
  });

  printableOverlayFields(template.fields, paymentData).forEach((field: OverlayField) => {
    const value = resolveOverlayValue(field, paymentData);
    doc.setFont("helvetica", field.bold ? "bold" : "normal");
    doc.setFontSize(field.font_size_pt);
    // `baseline: "top"` replica el `top: y_mm` del overlay HTML (jsPDF ancla en la línea base)
    doc.text(value, field.x_mm, field.y_mm, { baseline: "top" });
  });

  return doc;
}

/** URL temporal (blob) del PDF, para abrirlo o descargarlo desde la ventana de impresión. */
export function invoiceOverlayPdfUrl(
  template: InvoiceTemplate,
  paymentData: Record<string, string>,
): string {
  return URL.createObjectURL(buildInvoiceOverlayPdf(template, paymentData).output("blob"));
}

/** Nombre de archivo sugerido: `factura_016725.pdf`. */
export function invoiceOverlayPdfName(paymentData: Record<string, string>): string {
  const invoice = (paymentData.invoice_number || "").trim();
  return `factura_${invoice || "sin-numero"}.pdf`;
}
