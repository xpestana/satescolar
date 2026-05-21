import { InvoiceTemplate, OverlayField } from "@/pages/school/InvoiceTemplateConfig";

/**
 * Opens a new browser window with the invoice overlay positioned for printing.
 * The user places the blank physical invoice in the printer, then prints this page.
 * Only the data fields are rendered — the blank invoice form provides all labels/borders.
 */
export function printInvoiceOverlay(template: InvoiceTemplate, paymentData: Record<string, string>) {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;

  const fields = (template.fields || []).filter((f: OverlayField) => !!paymentData[f.key]);

  const fieldsHtml = fields
    .map((f: OverlayField) => {
      const value = paymentData[f.key] || "";
      return `
        <div style="
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

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Factura</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: white; }

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
      }
      #controls button {
        padding: 8px 20px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
      }
      #btn-print {
        background: #2563eb;
        color: white;
      }
      #btn-close {
        background: #e2e8f0;
        color: #374151;
      }
      #overlay {
        border: 1px solid #cbd5e1;
        background: white;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      }
      .field-label {
        display: block;
      }
    }

    /* On print, hide controls */
    @media print {
      #controls { display: none !important; }
      body { background: white; padding: 0; }
      #overlay { border: none; box-shadow: none; }
    }
  </style>
</head>
<body>
  <div id="controls">
    <span style="font-size:13px;color:#64748b;">
      Coloca la factura en blanco en la impresora, luego haz clic en Imprimir.
    </span>
    <button id="btn-print" onclick="window.print()">🖨 Imprimir</button>
    <button id="btn-close" onclick="window.close()">Cerrar</button>
  </div>

  <div id="overlay">
    ${fieldsHtml}
  </div>

  <script>
    // Auto-trigger print if opened from button (optional)
    // window.onload = () => window.print();
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
