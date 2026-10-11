import { describe, expect, it } from "vitest";
import { Packer } from "docx";
import * as XLSX from "xlsx";
import { EMPTY_GRADE_CERTIFICATE_SCHOOL_CONFIG, emptyGradeCertificate } from "./grade-certificate";
import { buildGradeCertificateDocument, certificateDataRowHeight } from "./grade-certificate-docx";
import { type PrintYear, buildCertificatePrintModel } from "./grade-certificate-print";

const yearsWith = (...counts: number[]): PrintYear[] =>
  counts.map((count, index) => ({
    title: `AÑO ${index + 1}`,
    rows: Array.from({ length: count }, () => ({
      subjectName: "ÁREA", grade: "**", gradeInWords: "**", evaluationType: "**", month: "**", year: "**", institution: "**",
    })),
  }));

describe("certificateDataRowHeight", () => {
  it("usa la altura del formato con las 7 áreas por año", () => {
    expect(certificateDataRowHeight(yearsWith(7, 7, 7, 7, 7))).toBe(373);
  });

  it("achica las filas cuando hay más áreas, sin bajar del mínimo legible", () => {
    const eleven = certificateDataRowHeight(yearsWith(7, 7, 11, 11, 11));
    expect(eleven).toBeLessThan(373);
    expect(eleven).toBeGreaterThan(236);
    expect(certificateDataRowHeight(yearsWith(20, 20, 20, 20, 20))).toBe(236);
  });

  it("cuenta la franja por el año con más áreas de cada par", () => {
    // 1° y 2° comparten franja: solo cuenta el mayor.
    expect(certificateDataRowHeight(yearsWith(8, 1, 7, 7, 7))).toBe(373);
    expect(certificateDataRowHeight(yearsWith(9, 1, 7, 7, 7))).toBeLessThan(373);
  });
});

describe("buildGradeCertificateDocument", () => {
  it("genera un .docx con los datos de la certificación", async () => {
    const model = buildCertificatePrintModel({
      document: { ...emptyGradeCertificate(), observations: "Observación de prueba" },
      identity: {
        documentId: "V33842293", lastNames: "MÁRQUEZ SUBERO", firstNames: "CORINA", birthDate: "18 DE JULIO 2012",
        birthCountry: "VENEZUELA", birthState: "MONAGAS", birthMunicipality: "MATURÍN",
      },
      schoolHeader: { nombre_plantel: "U.E. Demo", entidad_federal: "Monagas", director: "Rosa Tineo", cedula_director: "V 9270292" },
      schoolConfig: EMPTY_GRADE_CERTIFICATE_SCHOOL_CONFIG,
      today: "2026-10-10",
    });

    const buffer = await Packer.toBuffer(buildGradeCertificateDocument(model, null));
    // A .docx is a zip; SheetJS' container reader opens it without adding a dependency.
    const entry = XLSX.CFB.find(XLSX.CFB.read(buffer, { type: "buffer" }), "/word/document.xml");
    const xml = new TextDecoder().decode(new Uint8Array(entry!.content as ArrayLike<number>));

    for (const text of [
      "CERTIFICACIÓN DE CALIFICACIONES EMG", "31059", "MONAGAS, 10 DE OCTUBRE 2026", "U.E. DEMO", "MÁRQUEZ SUBERO",
      "18 DE JULIO 2012", "PRIMER AÑO", "QUINTO AÑO", "CASTELLANO", "ORIENTACIÓN Y CONVIVENCIA", "Observación de prueba",
      "ROSA TINEO", "V 9270292", "VALOR FISCAL",
    ]) {
      expect(xml).toContain(text);
    }
    // Cinco años con sus 7 áreas por defecto.
    expect(xml.match(/GEOGRAFÍA, HISTORIA Y CIUDADANÍA/g)).toHaveLength(5);
  });
});
