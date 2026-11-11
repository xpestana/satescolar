import { resolveImageToDataUrl } from "@/lib/image-resolve";
import ministryHeaderUrl from "@/assets/diagnosis-header.png";
import ministryFooterUrl from "@/assets/diagnosis-footer.png";

/**
 * Fixed Ministry letterhead shared by the diagnosis sheet and the primary descriptive boleta, so
 * both print exactly the same header (Ministry banner, school logo to its right) and footer (flag).
 * Same for every school.
 */

export { ministryHeaderUrl, ministryFooterUrl };

export interface LetterheadImages {
  headerLogo: string;
  footerLogo: string;
}

let imagesPromise: Promise<LetterheadImages> | null = null;

/** The banner and the flag inlined as data URLs (html2canvas-safe), once per session. */
export function loadLetterheadImages(): Promise<LetterheadImages> {
  imagesPromise ??= Promise.all([
    resolveImageToDataUrl(ministryHeaderUrl),
    resolveImageToDataUrl(ministryFooterUrl),
  ]).then(([headerLogo, footerLogo]) => {
    // A failed fetch must not stick for the whole session.
    if (!headerLogo || !footerLogo) imagesPromise = null;
    return { headerLogo, footerLogo };
  });
  return imagesPromise;
}

function escAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Space below the header, before the title. */
export const LETTERHEAD_HEADER_GAP_MM = 7;

/**
 * Ministry banner on the left, the school logo to its right (the banner shrinks to make room).
 * Inline styles only, so it renders the same inside any document. Empty when there is no image.
 */
export function letterheadHeaderHtml(opts: { headerLogo: string; schoolLogo?: string; schoolName?: string }): string {
  const ministry = opts.headerLogo
    ? `<img src="${escAttr(opts.headerLogo)}" alt="Ministerio del Poder Popular para la Educación" class="lh-ministry" style="display:block;flex:1;min-width:0;width:100%;height:auto">`
    : "";
  const school = opts.schoolLogo
    ? `<img src="${escAttr(opts.schoolLogo)}" alt="${escAttr(opts.schoolName ?? "")}" class="lh-school-logo" style="display:block;flex:none;height:24mm;max-width:32mm;object-fit:contain">`
    : "";
  if (!ministry && !school) return "";
  return `<div class="lh-header" style="display:flex;align-items:center;gap:5mm;margin-bottom:${LETTERHEAD_HEADER_GAP_MM}mm">${ministry}${school}</div>`;
}

/** The flag strip, full page width, at the bottom of the sheet. */
export function letterheadFooterHtml(footerLogo: string): string {
  return footerLogo
    ? `<img src="${escAttr(footerLogo)}" alt="" class="lh-footer" style="display:block;width:100%;height:auto">`
    : "";
}

/** Height of the flag strip printed at a given page width (the image is 1910×396). */
export function letterheadFooterHeightMm(pageWidthMm: number): number {
  return (pageWidthMm * 396) / 1910;
}
