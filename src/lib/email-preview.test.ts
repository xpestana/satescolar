import { describe, expect, it } from "vitest";
import { buildEmailPreviewHtml } from "./email-preview";

describe("buildEmailPreviewHtml", () => {
  it("renders the body with sample data, the school's name and colors (same layout as the real email)", () => {
    const html = buildEmailPreviewHtml(
      "welcome-staff",
      "<p>Hola {{nombre_usuario}} de {{nombre_colegio}}</p>",
      "#336699",
      "#ffffff",
      "U. E. Colegio Demo",
      null,
    );
    expect(html).toContain("<p>Hola Ana López de U. E. Colegio Demo</p>");
    expect(html).toContain("background-color:#336699");
    expect(html).toContain("SAT ESCOLAR");
  });

  it("keeps the concepts list as HTML in the delinquency preview", () => {
    const html = buildEmailPreviewHtml("delinquency", "{{conceptos_pendientes}}", "#1e78c8", "#ffffff", "Colegio", null);
    expect(html).toContain("<ul><li>Mensualidad Enero 2025");
  });

  it("returns an empty preview for an unknown type", () => {
    expect(buildEmailPreviewHtml("nope", "<p>x</p>", "#000000", "#ffffff", "Colegio", null)).toBe("");
  });
});
