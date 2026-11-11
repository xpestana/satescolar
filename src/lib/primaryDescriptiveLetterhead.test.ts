import { describe, expect, it } from "vitest";
import {
  DEFAULT_BACHILLERATO_CONFIG,
  SAMPLE_PRIMARY_DESCRIPTIVE_DATA,
  generatePrimaryDescriptiveHtml,
  wrapPrimaryDescriptiveBoletasHtml,
} from "./bachilleratoTemplate";

const data = {
  ...SAMPLE_PRIMARY_DESCRIPTIVE_DATA,
  school_name: "U.E. Colegio Demo",
  school_logo: "data:image/png;base64,SCHOOL",
  ministry_header: "data:image/png;base64,HEAD",
  ministry_footer: "data:image/png;base64,FOOT",
};
const cfg = {
  ...DEFAULT_BACHILLERATO_CONFIG,
  style: "primaria_descriptivo" as const,
  primaria: { slogan: "Construyendo vidas", show_slogan: true, show_footer_logo: true, footer_logo_url: "https://x/old.png" },
} as typeof DEFAULT_BACHILLERATO_CONFIG;

describe("primary descriptive boleta letterhead", () => {
  it("prints the Ministry banner with the school logo to its right, inside the repeating header", () => {
    const html = generatePrimaryDescriptiveHtml(cfg, data, 215.9, 279.4);
    const thead = html.slice(html.indexOf('<thead id="pdf-header">'), html.indexOf("</thead>"));
    expect(thead).toContain("lh-header");
    expect(thead.indexOf(data.ministry_header)).toBeLessThan(thead.indexOf(data.school_logo));
  });

  it("no longer prints the school name or slogan, and moves the school year under the title", () => {
    const html = generatePrimaryDescriptiveHtml(cfg, data, 215.9, 279.4);
    expect(html).not.toContain(">U.E. Colegio Demo<");
    expect(html).not.toContain("Construyendo vidas");
    expect(html).toContain(`AÑO ESCOLAR ${data.year_range}`);
  });

  it("prints the flag strip as the footer and ignores the old configurable footer logo", () => {
    const html = generatePrimaryDescriptiveHtml(cfg, data, 215.9, 279.4);
    const footer = html.slice(html.indexOf('<div id="pdf-footer">'));
    expect(footer).toContain(data.ministry_footer);
    expect(html).not.toContain("old.png");
  });

  it("whole-section sheets are page-tall with the flag at the bottom, one page each", () => {
    const body = generatePrimaryDescriptiveHtml(cfg, data, 215.9, 279.4, { bodyOnly: true });
    expect(body).toContain("min-height:279.4mm");
    expect(body.trim().endsWith(`class="lh-footer" style="display:block;width:100%;height:auto">\n</div>`)).toBe(true);
    const doc = wrapPrimaryDescriptiveBoletasHtml([body, body], 215.9, 279.4);
    expect(doc).toContain("@page{size:215.9mm 279.4mm;margin:0}");
    expect(doc.match(/class="boleta-page/g)).toHaveLength(2);
  });
});
