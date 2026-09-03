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

/** Hasta dónde se puede achicar la letra para que un texto largo quepa en su campo. */
export const MIN_FIT_FONT_PT = 5;

/**
 * Distancia del borde superior del campo a la línea base del texto, en "em".
 *
 * El editor, la vista previa y la ventana de impresión colocan el texto en un bloque con
 * `line-height: 1` cuyo borde superior es `y_mm`. Con Arial/Helvetica (ascendente 0,9052 em,
 * descendente 0,2119 em) el medio-interlineado es `(1 − 1,1171) / 2` y la línea base cae en
 * `−0,0586 + 0,9052 = 0,8466 em` bajo ese borde. El PDF usa el mismo número en vez de la
 * métrica interna de jsPDF, para que impresión y pantalla coincidan al milímetro.
 */
export const BASELINE_OFFSET_EM = 0.8466;

/** Puntos tipográficos a milímetros. */
export const ptToMm = (pt: number) => (pt * 25.4) / 72;

/** Línea base (lo que espera jsPDF) del campo cuyo borde superior está en `yMm`. */
export const overlayBaselineY = (yMm: number, fontSizePt: number) =>
  yMm + BASELINE_OFFSET_EM * ptToMm(fontSizePt);

export interface FittedText {
  text: string;
  fontSizePt: number;
  /** true si hubo que achicar la letra o recortar el texto. */
  adjusted: boolean;
}

/**
 * Ajusta un texto al **ancho del campo** (`width_mm`): primero achica la letra y, si aun así no
 * cabe, recorta con "…".
 *
 * Sin esto, un valor largo —los tres hermanos de una factura familiar en el campo "todos en una
 * línea"— se imprimía por encima de los campos vecinos. El overlay HTML ya lo contenía con
 * `overflow: hidden`; el PDF no tenía equivalente.
 */
export function fitTextToField(
  measure: (text: string, fontSizePt: number) => number,
  text: string,
  widthMm: number,
  fontSizePt: number,
): FittedText {
  if (!widthMm || widthMm <= 0 || !text) return { text, fontSizePt, adjusted: false };
  if (measure(text, fontSizePt) <= widthMm) return { text, fontSizePt, adjusted: false };

  let size = fontSizePt;
  while (size > MIN_FIT_FONT_PT) {
    size = Math.round((size - 0.5) * 10) / 10;
    if (measure(text, size) <= widthMm) return { text, fontSizePt: size, adjusted: true };
  }

  let truncated = text;
  while (truncated.length > 1 && measure(`${truncated}…`, size) > widthMm) {
    truncated = truncated.slice(0, -1);
  }
  return { text: `${truncated}…`, fontSizePt: size, adjusted: true };
}

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
    // El texto no puede salirse de su campo: se achica o se recorta para no pisar los vecinos
    const measure = (text: string, fontSizePt: number) => {
      doc.setFontSize(fontSizePt);
      return doc.getTextWidth(text);
    };
    const fitted = fitTextToField(measure, value, field.width_mm, field.font_size_pt);
    doc.setFontSize(fitted.fontSizePt);
    // El campo se ancla por su borde superior (y_mm), igual que el div del overlay HTML
    doc.text(fitted.text, field.x_mm, overlayBaselineY(field.y_mm, fitted.fontSizePt));
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
