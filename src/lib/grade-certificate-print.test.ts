import { describe, expect, it } from "vitest";
import {
  EMPTY_GRADE_CERTIFICATE_SCHOOL_CONFIG,
  addInstitution,
  createGradeRow,
  emptyGradeCertificate,
  updateYearRecord,
} from "./grade-certificate";
import type { CertificateStudentIdentity } from "./grade-certificate-identity";
import { type CertificatePrintSource, buildCertificatePrintModel } from "./grade-certificate-print";

const IDENTITY: CertificateStudentIdentity = {
  documentId: "V33842293",
  lastNames: "MÁRQUEZ SUBERO",
  firstNames: "CORINA DE LOS ÁNGELES",
  birthDate: "18 DE JULIO 2012",
  birthCountry: "VENEZUELA",
  birthState: "MONAGAS",
  birthMunicipality: "MATURÍN",
};

const HEADER = {
  codigo_plantel: "s2198d1608",
  nombre_plantel: "Unidad Educativa Alejandro de Humboldt",
  direccion_plantel: "Urbanización La Laguna",
  telefono_plantel: "(0291)6419475",
  municipio_plantel: "Maturin",
  entidad_federal: "Monagas",
  director: "Rosa Maribel Tineo Malave",
  cedula_director: "v 9270292",
};

function source(overrides: Partial<CertificatePrintSource> = {}): CertificatePrintSource {
  return {
    document: emptyGradeCertificate(),
    identity: IDENTITY,
    schoolHeader: HEADER,
    schoolConfig: EMPTY_GRADE_CERTIFICATE_SCHOOL_CONFIG,
    today: "2026-10-10",
    ...overrides,
  };
}

describe("buildCertificatePrintModel", () => {
  it("una certificación vacía sale con las 7 áreas y los asteriscos del formato", () => {
    const model = buildCertificatePrintModel(source());
    expect(model.institutions).toHaveLength(5);
    expect(model.institutions[2]).toEqual({ number: 3, name: "********", locality: "********", federalEntity: "********" });
    expect(model.years.map((y) => y.title)).toEqual(["PRIMER AÑO", "SEGUNDO AÑO", "TERCER AÑO", "CUARTO AÑO", "QUINTO AÑO"]);
    expect(model.years.every((y) => y.rows.length === 7)).toBe(true);
    expect(model.years[0].rows[0]).toEqual({
      subjectName: "CASTELLANO", grade: "**", gradeInWords: "**", evaluationType: "**", month: "**", year: "**", institution: "**",
    });
    expect(model.orientation[0]).toEqual({ yearLabel: "1°", literal: "**********" });
    expect(model.groups[4]).toEqual({ yearLabel: "5°", groupName: "***************", literal: "**" });
    expect(model.observations).toEqual([]);
  });

  it("toma del colegio la cabecera, el director y la entidad federal por defecto", () => {
    const model = buildCertificatePrintModel(source());
    expect(model.school).toEqual({
      code: "S2198D1608",
      name: "UNIDAD EDUCATIVA ALEJANDRO DE HUMBOLDT",
      address: "URBANIZACIÓN LA LAGUNA",
      phone: "(0291)6419475",
      municipality: "MATURIN",
      federalEntity: "MONAGAS",
      cdcee: "MONAGAS",
    });
    expect(model.director).toEqual({ name: "ROSA MARIBEL TINEO MALAVE", documentId: "V 9270292" });
    expect(model.cdceeDirector).toEqual({ name: "", documentId: "" });
    // Sin fecha de expedición usa la de hoy; sin lugar, la entidad federal.
    expect(model.issueLine).toBe("MONAGAS, 10 DE OCTUBRE 2026");
    expect(model).toMatchObject({ title: "CERTIFICACIÓN DE CALIFICACIONES EMG", planName: "EDUCACIÓN MEDIA GENERAL", planCode: "31059" });
  });

  it("los datos propios de la certificación mandan sobre los de por defecto", () => {
    const model = buildCertificatePrintModel(source({
      document: { ...emptyGradeCertificate(), issueDate: "2026-11-03", observations: " Primera línea \n\n segunda " },
      schoolConfig: { cdcee: "Zona Sur", issue_place: "Maturín", cdcee_director_name: "Ana Pérez", cdcee_director_document: "v 1" },
    }));
    expect(model.issueLine).toBe("MATURÍN, 3 DE NOVIEMBRE 2026");
    expect(model.school.cdcee).toBe("ZONA SUR");
    expect(model.cdceeDirector).toEqual({ name: "ANA PÉREZ", documentId: "V 1" });
    expect(model.observations).toEqual(["Primera línea", "segunda"]);
  });

  it("imprime las notas capturadas con letras, N° de institución y relleno en lo que falta", () => {
    let document = addInstitution(emptyGradeCertificate(), { name: "Otro plantel", locality: "Caripe", federalEntity: "mo" });
    document = addInstitution(document, { name: "U.E. Humboldt", locality: "Maturín", federalEntity: "MO", isOwnSchool: true });
    const own = document.institutions[1].id;
    document = updateYearRecord(document, 1, (y) => ({
      ...y,
      grades: [
        createGradeRow({ subjectName: "Castellano", grade: "14", evaluationType: "F", month: "07", year: "2025", institutionId: own }),
        createGradeRow({ subjectName: "Matemática", grade: "09" }),
        createGradeRow({ subjectName: "Cultura", grade: "B", evaluationType: "F" }),
        // Fila en blanco: no se imprime.
        createGradeRow(),
      ],
      orientationLiteral: "B",
      groupName: "Semillero científico",
      groupLiteral: "A",
    }));

    const model = buildCertificatePrintModel(source({ document }));
    expect(model.institutions.slice(0, 2)).toEqual([
      { number: 1, name: "OTRO PLANTEL", locality: "CARIPE", federalEntity: "MO" },
      { number: 2, name: "U.E. HUMBOLDT", locality: "MATURÍN", federalEntity: "MO" },
    ]);
    expect(model.years[0].rows).toEqual([
      { subjectName: "CASTELLANO", grade: "14", gradeInWords: "CATORCE", evaluationType: "F", month: "07", year: "2025", institution: "2" },
      { subjectName: "MATEMÁTICA", grade: "09", gradeInWords: "NUEVE", evaluationType: "**", month: "**", year: "**", institution: "**" },
      { subjectName: "CULTURA", grade: "B", gradeInWords: "**", evaluationType: "F", month: "**", year: "**", institution: "**" },
    ]);
    // Los demás años siguen con las áreas por defecto.
    expect(model.years[1].rows).toHaveLength(7);
    expect(model.orientation[0].literal).toBe("B");
    expect(model.groups[0]).toEqual({ yearLabel: "1°", groupName: "SEMILLERO CIENTÍFICO", literal: "A" });
  });

  it("arma un nombre de archivo sin acentos ni espacios", () => {
    expect(buildCertificatePrintModel(source()).fileName)
      .toBe("Certificacion_de_Notas_MARQUEZ_SUBERO_CORINA_DE_LOS_ANGELES_V33842293.docx");
    const anonymous = { ...IDENTITY, lastNames: "", firstNames: "", documentId: "" };
    expect(buildCertificatePrintModel(source({ identity: anonymous })).fileName).toBe("Certificacion_de_Notas.docx");
  });
});
