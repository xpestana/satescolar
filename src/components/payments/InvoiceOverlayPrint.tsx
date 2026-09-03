import { InvoiceTemplate, OverlayField } from "@/pages/school/InvoiceTemplateConfig";
import { printableOverlayFields, resolveOverlayValue } from "@/lib/invoiceFieldValue";
import { MIN_FIT_FONT_PT, invoiceOverlayPdfName, invoiceOverlayPdfUrl } from "@/lib/invoiceOverlayPdf";

/**
 * Abre una ventana con el overlay de la factura posicionado para imprimir sobre el formato
 * preimpreso: el papel en blanco va en la impresora y solo se imprimen los datos.
 *
 * Todo sale de la plantilla activa de `/formatos`: tamaño del papel, coordenadas en mm, tamaño
 * de fuente y negrita. La ventana ofrece dos caminos:
 *  - **PDF (recomendado):** lleva el tamaño de página dentro del archivo, así que el visor y el
 *    driver lo respetan sin rotar ni reescalar.
 *  - **Imprimir desde el navegador:** depende de que el diálogo quede en escala 100%, sin
 *    márgenes y con el papel del tamaño de la plantilla; por eso se recuerda en pantalla.
 */
export function printInvoiceOverlay(template: InvoiceTemplate, paymentData: Record<string, string>) {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;

  const fields = printableOverlayFields(template.fields, paymentData);

  const fieldsHtml = fields
    .map((f: OverlayField) => {
      const value = resolveOverlayValue(f, paymentData);
      return `
        <div class="field" data-size="${f.font_size_pt}" style="
          position: absolute;
          left: ${f.x_mm}mm;
          top: ${f.y_mm}mm;
          width: ${f.width_mm}mm;
          font-size: ${f.font_size_pt}pt;
          font-weight: ${f.bold ? "bold" : "normal"};
          font-family: Arial, Helvetica, sans-serif;
          white-space: nowrap;
          overflow: hidden;
          line-height: 1;
        ">${escapeHtml(value)}</div>
      `;
    })
    .join("\n");

  const pdfUrl = invoiceOverlayPdfUrl(template, paymentData);
  const pdfName = invoiceOverlayPdfName(paymentData);
  const paper = `${template.paper_width_mm} × ${template.paper_height_mm} mm`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Factura ${escapeHtml(paymentData.invoice_number || "")}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: white; }

    /* El tamaño del papel es EL DE LA PLANTILLA, no el del sistema */
    @page {
      size: ${template.paper_width_mm}mm ${template.paper_height_mm}mm;
      margin: 0;
    }

    #overlay {
      position: relative;
      width: ${template.paper_width_mm}mm;
      height: ${template.paper_height_mm}mm;
      overflow: hidden;
    }

    /* Screen preview styles */
    @media screen {
      body {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 20px;
        background: #f1f5f9;
        font-family: Arial, sans-serif;
      }
      #controls {
        margin-bottom: 16px;
        display: flex;
        gap: 10px;
        align-items: center;
        flex-wrap: wrap;
        justify-content: center;
        max-width: 700px;
      }
      #controls a, #controls button {
        padding: 8px 20px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        text-decoration: none;
        display: inline-block;
      }
      .btn-pdf { background: #16a34a; color: white; }
      .btn-pdf-open { background: #0f766e; color: white; }
      #btn-print { background: #2563eb; color: white; }
      #btn-close { background: #e2e8f0; color: #374151; }
      #hint {
        font-size: 12px;
        color: #475569;
        background: #fff7ed;
        border: 1px solid #fed7aa;
        border-radius: 6px;
        padding: 8px 12px;
        line-height: 1.5;
        max-width: 700px;
      }
      #overlay {
        border: 1px solid #cbd5e1;
        background: white;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      }
    }

    @media print {
      #controls, #hint { display: none !important; }
      body { background: white; padding: 0; }
      /* Sin reescalado ni márgenes: lo impreso debe medir lo mismo que la plantilla */
      html, body {
        width: ${template.paper_width_mm}mm;
        height: ${template.paper_height_mm}mm;
        margin: 0;
      }
      #overlay { border: none; box-shadow: none; page-break-after: avoid; }
    }
  </style>
</head>
<body>
  <div id="controls">
    <a class="btn-pdf" href="${pdfUrl}" download="${pdfName}">⬇ Descargar PDF (${paper})</a>
    <a class="btn-pdf-open" href="${pdfUrl}" target="_blank" rel="noopener">📄 Abrir PDF e imprimir</a>
    <button id="btn-print" onclick="window.print()">🖨 Imprimir desde el navegador</button>
    <button id="btn-close" onclick="window.close()">Cerrar</button>
  </div>

  <div id="hint">
    <strong>Para que calce sobre la factura física (${paper}):</strong>
    lo más seguro es <strong>imprimir el PDF</strong>, que ya trae ese tamaño de página.
    Si imprimes desde el navegador, en el diálogo elige
    <strong>Márgenes: Ninguno</strong>, <strong>Escala: 100%</strong> (no “Ajustar al área de
    impresión”) y el <strong>tamaño de papel ${paper}</strong>; si el papel queda en Carta u
    Oficio, el driver rota y reduce el contenido.
  </div>

  <div id="overlay">
    ${fieldsHtml}
  </div>

  <script>
    // Mismo ajuste que el PDF: si un texto no cabe en su campo se achica la letra (hasta ${MIN_FIT_FONT_PT}pt)
    // en vez de invadir los campos vecinos. El resto lo recorta el overflow del propio campo.
    document.querySelectorAll(".field").forEach(function (el) {
      var size = parseFloat(el.dataset.size);
      while (el.scrollWidth > el.clientWidth && size > ${MIN_FIT_FONT_PT}) {
        size = Math.round((size - 0.5) * 10) / 10;
        el.style.fontSize = size + "pt";
      }
    });
  </script>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
