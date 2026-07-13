import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/**
 * Renders a full HTML document offscreen and returns it as a paginated PDF Blob.
 * Caller is responsible for what to do with the blob (preview, download, upload…).
 *
 * Paper dimensions are extracted from the HTML's @page rule, falling back to
 * the explicit defaults (US Letter).
 */
export async function htmlToPdfBlob(
  html: string,
  fallbackPaperWidthMm = 215.9,
  fallbackPaperHeightMm = 279.4,
): Promise<Blob> {
  // Try to extract @page size from the HTML
  let paperW = fallbackPaperWidthMm;
  let paperH = fallbackPaperHeightMm;
  const match = html.match(/@page\s*\{[^}]*size\s*:\s*([\d.]+)mm\s+([\d.]+)mm/);
  if (match) {
    paperW = parseFloat(match[1]);
    paperH = parseFloat(match[2]);
  }

  // Mount a hidden iframe — do NOT fix height to paperH or content gets clipped vs preview
  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    `position:fixed;left:-99999px;top:0;width:${paperW}mm;border:none;visibility:hidden;overflow:visible;`;
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
    await new Promise((r) => setTimeout(r, 100));

    const controls = doc.getElementById("controls");
    if (controls) controls.style.display = "none";

    const pdf = new jsPDF({
      orientation: paperH >= paperW ? "portrait" : "landscape",
      unit: "mm",
      format: [paperW, paperH],
    });

    const scale = 2;
    const headerEl = doc.getElementById("pdf-header") as HTMLElement | null;
    const footerEl = doc.getElementById("pdf-footer") as HTMLElement | null;

    if (headerEl) {
      await renderPrimariaWithHeaderFooter(pdf, doc.body, headerEl, footerEl, paperW, paperH, scale);
      return pdf.output("blob");
    }

    const pageEls = Array.from(doc.querySelectorAll(".boleta-page")) as HTMLElement[];
    if (pageEls.length > 0) {
      for (let i = 0; i < pageEls.length; i++) {
        if (i > 0) pdf.addPage([paperW, paperH]);
        await addElementAsPdfPage(pdf, pageEls[i], paperW, paperH, scale);
      }
      return pdf.output("blob");
    }

    const boletinEl = doc.querySelector(".boletin") as HTMLElement | null;
    const root = boletinEl ?? doc.body;
    await addElementAsPdfPage(pdf, root, paperW, paperH, scale);

    return pdf.output("blob");
  } finally {
    document.body.removeChild(iframe);
  }
}

/** One logical page: capture element, scale down if taller than paperH, center on sheet. */
async function addElementAsPdfPage(
  pdf: jsPDF,
  el: HTMLElement,
  paperW: number,
  paperH: number,
  scale: number,
): Promise<void> {
  const canvas = await html2canvas(el, {
    scale,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    width: el.scrollWidth,
    height: el.scrollHeight,
    windowWidth: el.scrollWidth,
    windowHeight: el.scrollHeight,
  });

  const pxPerMm = canvas.width / paperW;
  const pageHpx = paperH * pxPerMm;

  const pageCanvas = document.createElement("canvas");
  pageCanvas.width = canvas.width;
  pageCanvas.height = Math.round(pageHpx);
  const ctx = pageCanvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

  let drawW = canvas.width;
  let drawH = canvas.height;

  if (canvas.height > pageHpx) {
    // Content taller than the page: scale down uniformly and center horizontally.
    const fit = pageHpx / canvas.height;
    drawW = canvas.width * fit;
    drawH = pageHpx;
    const offsetX = (canvas.width - drawW) / 2;
    ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, offsetX, 0, drawW, drawH);
  } else {
    ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, drawW, drawH);
  }

  pdf.addImage(pageCanvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, paperW, paperH);
}

/** Primaria descriptivo: repeating header/footer slices (unchanged behavior). */
async function renderPrimariaWithHeaderFooter(
  pdf: jsPDF,
  body: HTMLElement,
  headerEl: HTMLElement,
  footerEl: HTMLElement | null,
  paperW: number,
  paperH: number,
  scale: number,
): Promise<void> {
  const canvas = await html2canvas(body, {
    scale,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    width: body.scrollWidth,
    height: body.scrollHeight,
    windowWidth: body.scrollWidth,
    windowHeight: body.scrollHeight,
  });

  const pxPerMm = canvas.width / paperW;
  const pageHpx = Math.floor(paperH * pxPerMm);

  const headerHpx = Math.round(headerEl.offsetHeight * scale);
  const footerHpx = footerEl ? Math.round(footerEl.offsetHeight * scale) : 0;
  const contTopPadHpx = Math.round(8 * pxPerMm);
  const firstPageAvailHpx = pageHpx - headerHpx - footerHpx;
  const laterPageAvailHpx = firstPageAvailHpx - contTopPadHpx;
  const contentTotalHpx = canvas.height - headerHpx - footerHpx;

  let yOffset = 0;
  let isFirstPage = true;
  while (yOffset < contentTotalHpx) {
    if (!isFirstPage) pdf.addPage([paperW, paperH]);

    const availableHpx = isFirstPage ? firstPageAvailHpx : laterPageAvailHpx;
    const contentDestY = isFirstPage ? headerHpx : headerHpx + contTopPadHpx;
    isFirstPage = false;

    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    pageCanvas.height = pageHpx;
    const ctx = pageCanvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

    ctx.drawImage(canvas, 0, 0, canvas.width, headerHpx, 0, 0, canvas.width, headerHpx);

    const sliceH = Math.min(availableHpx, contentTotalHpx - yOffset);
    ctx.drawImage(
      canvas,
      0, headerHpx + yOffset, canvas.width, sliceH,
      0, contentDestY, canvas.width, sliceH,
    );

    if (footerHpx > 0) {
      ctx.drawImage(
        canvas,
        0, canvas.height - footerHpx, canvas.width, footerHpx,
        0, pageHpx - footerHpx, canvas.width, footerHpx,
      );
    }

    pdf.addImage(pageCanvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, paperW, paperH);
    yOffset += availableHpx;
  }
}

/**
 * Convenience wrapper: renders the HTML to a PDF blob and triggers a file download.
 * Kept for callers that just want a direct download without a preview step.
 */
export async function downloadHtmlAsPdf(
  html: string,
  filename: string,
  fallbackPaperWidthMm = 215.9,
  fallbackPaperHeightMm = 279.4,
): Promise<void> {
  const blob = await htmlToPdfBlob(html, fallbackPaperWidthMm, fallbackPaperHeightMm);
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
