import { describe, expect, it } from "vitest";
import {
  buildCertificateStudentIdentity,
  formatCertificateDate,
  identityLabel,
  missingIdentityFields,
} from "./grade-certificate-identity";

const GEO: Record<string, string> = { "state-1": "Monagas", "muni-1": "Maturín" };
const resolveName = (value: unknown) => (typeof value === "string" ? GEO[value] ?? value : "");

describe("formatCertificateDate", () => {
  it("escribe la fecha como el formato oficial", () => {
    expect(formatCertificateDate("2012-07-18")).toBe("18 DE JULIO 2012");
    expect(formatCertificateDate("2026-10-05T00:00:00")).toBe("5 DE OCTUBRE 2026");
  });

  it("queda vacía si no es una fecha", () => {
    expect(formatCertificateDate("")).toBe("");
    expect(formatCertificateDate(null)).toBe("");
    expect(formatCertificateDate("18/07/2012")).toBe("");
    expect(formatCertificateDate("2012-13-18")).toBe("");
  });
});

describe("buildCertificateStudentIdentity", () => {
  it("toma los datos de la ficha en mayúsculas y resuelve estado y municipio", () => {
    const identity = buildCertificateStudentIdentity({
      document_id: "v33842293",
      form_data: {
        primer_apellido: "Márquez",
        segundo_apellido: "Subero",
        primer_nombre: "Corina",
        segundo_nombre: "de los Ángeles",
        fecha_nacimiento: "2012-07-18",
        pais_nacimiento: "Venezuela",
        estado_nacimiento: "state-1",
        municipio_nacimiento: "muni-1",
      },
    }, resolveName);
    expect(identity).toEqual({
      documentId: "V33842293",
      lastNames: "MÁRQUEZ SUBERO",
      firstNames: "CORINA DE LOS ÁNGELES",
      birthDate: "18 DE JULIO 2012",
      birthCountry: "VENEZUELA",
      birthState: "MONAGAS",
      birthMunicipality: "MATURÍN",
    });
    expect(missingIdentityFields(identity)).toEqual([]);
  });

  it("usa los campos viejos de nombre y la fecha por partes", () => {
    const identity = buildCertificateStudentIdentity({
      document_id: null,
      form_data: { nombre: "Ana", apellido: "Pérez", dia_nacimiento: "3", mes_nacimiento: "02", anio_nacimiento: "2011" },
    }, resolveName);
    expect(identity).toMatchObject({ lastNames: "PÉREZ", firstNames: "ANA", birthDate: "3 DE FEBRERO 2011" });
  });

  it("sin país asume Venezuela y avisa de lo que falta", () => {
    const identity = buildCertificateStudentIdentity({ document_id: "", form_data: null }, resolveName);
    expect(identity.birthCountry).toBe("VENEZUELA");
    expect(missingIdentityFields(identity)).toEqual([
      "documentId", "lastNames", "firstNames", "birthDate", "birthState", "birthMunicipality",
    ]);
    expect(identityLabel("birthDate")).toBe("Fecha de nacimiento");
  });

  it("conserva el país y el estado escritos a mano de quien nació fuera", () => {
    const identity = buildCertificateStudentIdentity({
      document_id: "E1",
      form_data: { pais_nacimiento: "Colombia", estado_nacimiento: "Norte de Santander" },
    }, resolveName);
    expect(identity).toMatchObject({ birthCountry: "COLOMBIA", birthState: "NORTE DE SANTANDER" });
  });
});
