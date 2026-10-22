import { describe, expect, it } from "vitest";
import {
  DiagnosisSheetData,
  generateDiagnosisDocumentHtml,
  generateDiagnosisSheetBody,
  printableSignatures,
} from "./diagnosisSheet";

const images = { headerLogo: "data:image/png;base64,HEAD", footerLogo: "data:image/png;base64,FOOT" };

const sheet = (overrides: Partial<DiagnosisSheetData> = {}): DiagnosisSheetData => ({
  schoolName: "U.E. Colegio Demo",
  yearRange: "2026-2027",
  studentName: "Ana María Pérez Gómez",
  documentId: "V-12345678",
  gradeLabel: "1er Grado",
  sectionName: "U",
  strengths: "<ul><li>Reconoce vocales</li></ul>",
  weaknesses: "<p>En proceso de adaptación</p>",
  improvements: "<p>Reforzar la lectura</p>",
  signatures: [
    { nombre: "Lcda. Docente", cedula: "", cargo: "Docente", firma_url: "", sello_url: "" },
    { nombre: "MSc. Directora", cedula: "V-1", cargo: "Directora", firma_url: "", sello_url: "", enabled: true },
  ],
  ...overrides,
});

describe("generateDiagnosisSheetBody", () => {
  it("prints the header data, the three sections and the logos", () => {
    const html = generateDiagnosisSheetBody(sheet(), images);
    expect(html).toContain("FICHA DESCRIPTIVA DEL ESTUDIANTE (DIAGNÓSTICO)");
    expect(html).toContain("AÑO ESCOLAR 2026-2027");
    expect(html).toContain("U.E. Colegio Demo");
    expect(html).toContain("Ana María Pérez Gómez");
    expect(html).toContain("V-12345678");
    expect(html).toContain("1er Grado");
    expect(html).toContain("SECCIÓN:</b> U");
    expect(html).toContain("FORTALEZAS:");
    expect(html).toContain("DEBILIDADES:");
    expect(html).toContain("ASPECTOS A SUPERAR:");
    expect(html).toContain(images.headerLogo);
    expect(html).toContain(images.footerLogo);
  });

  it("skips empty sections, including editor leftovers like <br> or &nbsp;", () => {
    const html = generateDiagnosisSheetBody(sheet({ weaknesses: "<div><br></div>", improvements: "&nbsp;" }), images);
    expect(html).toContain("FORTALEZAS:");
    expect(html).not.toContain("DEBILIDADES:");
    expect(html).not.toContain("ASPECTOS A SUPERAR:");
  });

  it("omits the document id and the section when they are missing", () => {
    const html = generateDiagnosisSheetBody(sheet({ documentId: null, sectionName: null }), images);
    expect(html).not.toContain("C.I. / C.E.");
    expect(html).not.toContain("SECCIÓN");
  });

  it("escapes the student name and the school name", () => {
    const html = generateDiagnosisSheetBody(sheet({ studentName: "<b>X</b>", schoolName: "A & B" }), images);
    expect(html).toContain("&lt;b&gt;X&lt;/b&gt;");
    expect(html).toContain("A &amp; B");
  });

  it("strips scripts and event handlers from the rich text", () => {
    const html = generateDiagnosisSheetBody(
      sheet({ strengths: '<p onclick="alert(1)">Lee</p><script>alert(2)</script><img src=x onerror="alert(3)">' }),
      images,
    );
    expect(html).toContain("<p>Lee</p>");
    expect(html).not.toContain("script");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("onerror");
  });

  it("prints only the enabled, non-blank signatures and leaves out an empty cédula", () => {
    const html = generateDiagnosisSheetBody(
      sheet({
        signatures: [
          { nombre: "Lcda. Docente", cedula: "", cargo: "Docente", firma_url: "", sello_url: "" },
          { nombre: "Apagada", cedula: "", cargo: "Coordinadora", firma_url: "", sello_url: "", enabled: false },
          { nombre: "", cedula: "", cargo: "", firma_url: "", sello_url: "" },
        ],
      }),
      images,
    );
    expect(html).toContain("Lcda. Docente");
    expect(html).not.toContain("Apagada");
    expect(html.match(/border-top:1px solid #000/g)).toHaveLength(1);
  });

  it("has no signature block when no signature prints", () => {
    const html = generateDiagnosisSheetBody(sheet({ signatures: [] }), images);
    expect(html).not.toContain("dx-signatures\"");
  });
});

describe("generateDiagnosisDocumentHtml", () => {
  it("renders one Letter page per student", () => {
    const html = generateDiagnosisDocumentHtml([sheet(), sheet({ studentName: "Luis" })], images);
    expect(html).toContain("@page{size:215.9mm 279.4mm");
    expect(html.match(/class="boleta-page/g)).toHaveLength(2);
    expect(html).toContain('class="boleta-page last"');
  });
});

describe("printableSignatures", () => {
  it("treats a missing enabled flag as active", () => {
    const sigs = printableSignatures([{ nombre: "A", cedula: "", cargo: "", firma_url: "", sello_url: "" }]);
    expect(sigs).toHaveLength(1);
  });
});
