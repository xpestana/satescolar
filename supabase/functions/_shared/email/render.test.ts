import { describe, expect, it } from "vitest";
import { escapeHtml, safeColor, wrapWithEmailLayout } from "./layout";
import { defaultTemplate, fillPlaceholders, renderEmailTemplate } from "./render";
import { EMAIL_TEMPLATES, EMAIL_TEMPLATE_TYPES, isEmailTemplateType } from "./templates";

const school = { name: "Colegio Demo", logoUrl: null };

describe("layout", () => {
  it("escapes HTML special characters", () => {
    expect(escapeHtml(`<b>"Tom" & 'Jerry'</b>`)).toBe("&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;");
    expect(escapeHtml(null)).toBe("");
  });

  it("only lets hex colors into styles", () => {
    expect(safeColor("#ABCDEF", "#000")).toBe("#ABCDEF");
    expect(safeColor("red;background:url(x)", "#000")).toBe("#000");
    expect(safeColor(null, "#123")).toBe("#123");
  });

  it("escapes the school name and logo url", () => {
    const html = wrapWithEmailLayout("<p>x</p>", {
      primaryColor: "#111111",
      textColor: "#ffffff",
      schoolName: "Colegio <Script>",
      logoUrl: 'https://x.test/a.png" onerror="alert(1)',
    });
    expect(html).toContain("Colegio &lt;Script&gt;");
    expect(html).toContain("a.png&quot; onerror=&quot;alert(1)");
    expect(html).not.toContain('onerror="');
  });

  it("is fluid on phones: no fixed 560px table, max-width instead, and a mobile media query", () => {
    const html = wrapWithEmailLayout("<p>x</p>", {
      primaryColor: "#111111",
      textColor: "#ffffff",
      schoolName: "Colegio",
      logoUrl: null,
    });
    expect(html).not.toContain('width="560"');
    expect(html).toContain("max-width:560px");
    expect(html).toMatch(/@media only screen and \(max-width: 600px\)/);
    expect(html).toContain('name="viewport"');
  });
});

describe("fillPlaceholders", () => {
  it("escapes values except the HTML ones and keeps unknown placeholders", () => {
    const out = fillPlaceholders(
      "{{a}} {{b}} {{missing}}",
      { a: "<i>x</i>", b: "<ul><li>1</li></ul>" },
      { escape: true, htmlKeys: new Set(["b"]) },
    );
    expect(out).toBe("&lt;i&gt;x&lt;/i&gt; <ul><li>1</li></ul> {{missing}}");
  });
});

describe("renderEmailTemplate", () => {
  it("renders subject and body with the school's colors", () => {
    const { subject, html } = renderEmailTemplate(
      "welcome-family",
      { subject: "Hola {{nombre_colegio}}\n", body_html: "<p>{{email_usuario}}</p>", primary_color: "#123456", text_color: "#ffffff" },
      { nombre_colegio: "Colegio Demo", email_usuario: "a@example.com" },
      school,
    );
    expect(subject).toBe("Hola Colegio Demo");
    expect(html).toContain("<p>a@example.com</p>");
    expect(html).toContain("background-color:#123456");
  });

  it("escapes a student name with HTML but keeps the concepts list as HTML", () => {
    const { html } = renderEmailTemplate(
      "delinquency",
      defaultTemplate("delinquency"),
      { nombre_estudiante: "<b>Ana</b>", conceptos_pendientes: "<ul><li>Cuota</li></ul>" },
      school,
    );
    expect(html).toContain("&lt;b&gt;Ana&lt;/b&gt;");
    expect(html).toContain("<ul><li>Cuota</li></ul>");
  });

  it("falls back to default colors when the stored ones are invalid", () => {
    const { html } = renderEmailTemplate(
      "welcome-teacher",
      { ...defaultTemplate("welcome-teacher"), primary_color: "javascript:x", text_color: null },
      {},
      school,
    );
    expect(html).toContain("background-color:#1e78c8");
  });
});

describe("template catalog", () => {
  it("every placeholder in a default template is a declared variable", () => {
    for (const type of EMAIL_TEMPLATE_TYPES) {
      const def = EMAIL_TEMPLATES[type];
      const declared = new Set([...def.variables.map((v) => v.key), "primary_color"]);
      const used = [...`${def.subject} ${def.body}`.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
      for (const key of used) expect(declared.has(key), `${type}: {{${key}}}`).toBe(true);
    }
  });

  it("has sample data for every variable, so previews and tests never show {{...}}", () => {
    for (const type of EMAIL_TEMPLATE_TYPES) {
      const def = EMAIL_TEMPLATES[type];
      const { html, subject } = renderEmailTemplate(type, defaultTemplate(type), def.sample, school);
      expect(`${subject} ${html}`, type).not.toMatch(/\{\{\w+\}\}/);
    }
  });

  it("knows its types; payment-reminder is the only one not sent automatically", () => {
    expect(isEmailTemplateType("welcome-staff")).toBe(true);
    expect(isEmailTemplateType("custom-html")).toBe(false);
    expect(EMAIL_TEMPLATE_TYPES.filter((t) => !EMAIL_TEMPLATES[t].sendsAutomatically)).toEqual(["payment-reminder"]);
  });
});

describe("wrapWithEmailLayout logoOnly", () => {
  it("keeps the school name title by default and drops it with logoOnly", () => {
    const base = { primaryColor: "#123456", textColor: "#ffffff", schoolName: "Colegio X", logoUrl: "https://x/logo.png" };
    expect(wrapWithEmailLayout("<p>hi</p>", base)).toContain("<h2");
    expect(wrapWithEmailLayout("<p>hi</p>", { ...base, logoOnly: true })).not.toContain("<h2");
    expect(wrapWithEmailLayout("<p>hi</p>", { ...base, logoUrl: null, logoOnly: true })).toContain("<h2");
  });
});
