import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/**
 * Renders a full HTML document offscreen and downloads it as a paginated PDF.
 * No window/tab is opened; the browser fires a normal file download.
 *
 * Paper dimensions are extracted from the HTML's @page rule, falling back to
 * the explicit defaults (US Letter).
 */
export async function downloadHtmlAsPdf(
  html: string,
  filename: string,
  fallbackPaperWidthMm = 215.9,
  fallbackPaperHeightMm = 279.4,
): Promise<void> {
  // Try to extract @page size from the HTML
  let paperW = fallbackPaperWidthMm;
  let paperH = fallbackPaperHeightMm;
  const match = html.match(/@page\s*\{[^}]*size\s*:\s*([\d.]+)mm\s+([\d.]+)mm/);
  if (match) {
    paperW = parseFloat(match[1]);
    paperH = parseFloat(match[2]);
  }

  // Mount a hidden iframe and write the HTML into it
  const iframe = document.createElement("iframe");
  iframe.style.cssText = `position:fixed;left:-99999px;top:0;width:${paperW}mm;height:${paperH}mm;border:none;visibility:hidden;`;
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument;
    if (!doc) throw new Error("No iframe document");
    doc.open();
    doc.write(html);
    doc.close();

    // Wait for document and images to be ready
    await new Promise<void>((resolve) => {
      const w = iframe.contentWindow;
      if (!w) return resolve();
      if (w.document.readyState === "complete") resolve();
      else w.addEventListener("load", () => resolve(), { once: true });
    });
    const imgs = Array.from(doc.querySelectorAll("img"));
    await Promise.all(
      imgs.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((r) => {
              img.onload = () => r();
              img.onerror = () => r();
            }),
      ),
    );
    // Give layout one more tick
    await new Promise((r) => setTimeout(r, 50));

    // Hide any in-document #controls bar before capture
    const controls = doc.getElementById("controls");
    if (controls) controls.style.display = "none";

    const body = doc.body;
    const canvas = await html2canvas(body, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      width: body.scrollWidth,
      height: body.scrollHeight,
      windowWidth: body.scrollWidth,
      windowHeight: body.scrollHeight,
    });

    const pdf = new jsPDF({
      orientation: paperH >= paperW ? "portrait" : "landscape",
      unit: "mm",
      format: [paperW, paperH],
    });

    const pxPerMm = canvas.width / paperW;
    const pageHpx = Math.floor(paperH * pxPerMm);

    let yPx = 0;
    let firstPage = true;
    while (yPx < canvas.height) {
      if (!firstPage) pdf.addPage();
      firstPage = false;

      const sliceH = Math.min(pageHpx, canvas.height - yPx);
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = sliceH;
      const ctx = slice.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(canvas, 0, -yPx);
      }

      const sliceHmm = sliceH / pxPerMm;
      pdf.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, paperW, sliceHmm);

      yPx += pageHpx;
    }

    pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
  } finally {
    document.body.removeChild(iframe);
  }
}
