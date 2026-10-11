import { describe, expect, it } from "vitest";
import {
  DEFAULT_CERTIFICATE_SUBJECTS,
  MAX_CERTIFICATE_INSTITUTIONS,
  addInstitution,
  applyToYearRows,
  buildOwnSchoolInstitution,
  countGradesOfInstitution,
  createDefaultGradeRows,
  createGradeRow,
  emptyGradeCertificate,
  findStateAcronym,
  institutionNumber,
  isGradeOutOfRange,
  isGradeRowFilled,
  moveInstitution,
  normalizeSubjectName,
  padTwoDigits,
  parseGradeCertificate,
  removeInstitution,
  serializeGradeCertificate,
  toCertificateText,
  updateYearRecord,
  yearLevelFromGradeLevel,
} from "./grade-certificate";

describe("emptyGradeCertificate", () => {
  it("trae los cinco años vacíos y ninguna institución", () => {
    const doc = emptyGradeCertificate();
    expect(doc.institutions).toEqual([]);
    expect(doc.yearRecords.map((y) => y.yearLevel)).toEqual([1, 2, 3, 4, 5]);
    expect(doc.yearRecords.every((y) => y.grades.length === 0)).toBe(true);
  });
});

describe("parseGradeCertificate", () => {
  it("sin fila guardada devuelve el documento vacío", () => {
    expect(parseGradeCertificate(null)).toEqual(emptyGradeCertificate());
  });

  it("completa los años que faltan y los ordena", () => {
    const doc = parseGradeCertificate({
      institutions: [],
      year_records: [{ yearLevel: 3, grades: [], orientationLiteral: "B", groupName: "", groupLiteral: "" }],
      observations: null,
      issue_date: null,
    });
    expect(doc.yearRecords.map((y) => y.yearLevel)).toEqual([1, 2, 3, 4, 5]);
    expect(doc.yearRecords[2].orientationLiteral).toBe("B");
    expect(doc.observations).toBe("");
    expect(doc.issueDate).toBe("");
  });

  it("descarta lo que no tiene forma válida sin perder el resto", () => {
    const doc = parseGradeCertificate({
      institutions: [{ id: "a", name: "U.E. UNO" }, { name: "sin id" }, "basura"],
      year_records: [{ yearLevel: 9, grades: [] }, { yearLevel: 1, grades: [{ id: "g1", subjectName: "CASTELLANO", grade: 14 }] }],
      observations: "obs",
      issue_date: "2026-10-10",
    });
    expect(doc.institutions).toEqual([
      { id: "a", name: "U.E. UNO", locality: "", federalEntity: "", isOwnSchool: false },
    ]);
    // A numeric grade is not a valid string: the field falls back to "" but the row survives.
    expect(doc.yearRecords[0].grades).toHaveLength(1);
    expect(doc.yearRecords[0].grades[0]).toMatchObject({ subjectName: "CASTELLANO", grade: "" });
    expect(doc.issueDate).toBe("2026-10-10");
  });

  it("limpia la institución de una nota si ya no está en la lista", () => {
    const doc = parseGradeCertificate({
      institutions: [{ id: "a", name: "U.E. UNO" }],
      year_records: [{
        yearLevel: 1,
        grades: [
          { id: "g1", subjectName: "CASTELLANO", institutionId: "a" },
          { id: "g2", subjectName: "MATEMÁTICA", institutionId: "borrada" },
        ],
      }],
      observations: "",
      issue_date: null,
    });
    expect(doc.yearRecords[0].grades.map((g) => g.institutionId)).toEqual(["a", null]);
  });

  it("no pasa de cinco instituciones", () => {
    const institutions = Array.from({ length: 7 }, (_, i) => ({ id: `i${i}`, name: `Plantel ${i}` }));
    expect(parseGradeCertificate({ institutions, year_records: [], observations: "", issue_date: null }).institutions)
      .toHaveLength(MAX_CERTIFICATE_INSTITUTIONS);
  });
});

describe("serializeGradeCertificate", () => {
  it("guarda la fecha vacía como null y recorta las observaciones", () => {
    const row = serializeGradeCertificate({ ...emptyGradeCertificate(), observations: "  nota  " });
    expect(row.issue_date).toBeNull();
    expect(row.observations).toBe("nota");
    expect(row.year_records).toHaveLength(5);
  });

  it("ida y vuelta conserva el documento", () => {
    let doc = addInstitution(emptyGradeCertificate(), { name: "U.E. UNO", locality: "MATURIN", federalEntity: "MO" });
    doc = updateYearRecord(doc, 1, (y) => ({
      ...y,
      grades: [createGradeRow({ subjectName: "CASTELLANO", grade: "14", institutionId: doc.institutions[0].id })],
      orientationLiteral: "B",
    }));
    doc = { ...doc, issueDate: "2026-10-10" };
    expect(parseGradeCertificate(serializeGradeCertificate(doc))).toEqual(doc);
  });
});

describe("yearLevelFromGradeLevel", () => {
  it("convierte 1er–5to año", () => {
    expect(yearLevelFromGradeLevel("1_ano")).toBe(1);
    expect(yearLevelFromGradeLevel("5_ano")).toBe(5);
  });

  it("deja fuera 6to año y lo que no es bachillerato", () => {
    expect(yearLevelFromGradeLevel("6_ano")).toBeNull();
    expect(yearLevelFromGradeLevel("6_grado")).toBeNull();
    expect(yearLevelFromGradeLevel(null)).toBeNull();
  });
});

describe("normalizeSubjectName", () => {
  it("ignora mayúsculas, acentos y espacios de más", () => {
    expect(normalizeSubjectName("  Matemática ")).toBe("MATEMATICA");
    expect(normalizeSubjectName("Geografía,  Historia y Ciudadanía")).toBe("GEOGRAFIA, HISTORIA Y CIUDADANIA");
    expect(normalizeSubjectName(null)).toBe("");
  });
});

describe("toCertificateText", () => {
  it("pasa a mayúsculas conservando Ñ y acentos, sin espacios de más", () => {
    expect(toCertificateText("  unidad  educativa peña ")).toBe("UNIDAD EDUCATIVA PEÑA");
    expect(toCertificateText("maturín")).toBe("MATURÍN");
    expect(toCertificateText(null)).toBe("");
  });
});

describe("padTwoDigits", () => {
  it("pone el cero delante de un solo dígito", () => {
    expect(padTwoDigits("9")).toBe("09");
    expect(padTwoDigits(" 7 ")).toBe("07");
  });

  it("deja igual lo demás", () => {
    expect(padTwoDigits("14")).toBe("14");
    expect(padTwoDigits("A")).toBe("A");
    expect(padTwoDigits("")).toBe("");
  });
});

describe("isGradeOutOfRange", () => {
  it("avisa de notas numéricas fuera de 01–20", () => {
    expect(isGradeOutOfRange("21")).toBe(true);
    expect(isGradeOutOfRange("0")).toBe(true);
    expect(isGradeOutOfRange("00")).toBe(true);
  });

  it("no juzga notas válidas, vacías o en texto", () => {
    expect(isGradeOutOfRange("01")).toBe(false);
    expect(isGradeOutOfRange("20")).toBe(false);
    expect(isGradeOutOfRange("")).toBe(false);
    expect(isGradeOutOfRange("EX")).toBe(false);
  });
});

describe("findStateAcronym", () => {
  const states = [{ name: "Monagas", acronym: "MO" }, { name: "Táchira", acronym: " ta " }, { name: "Sin sigla", acronym: null }];

  it("encuentra la sigla sin importar mayúsculas ni acentos", () => {
    expect(findStateAcronym(states, "MONAGAS")).toBe("MO");
    expect(findStateAcronym(states, "tachira")).toBe("TA");
  });

  it("queda vacía si no conoce el estado o no tiene sigla", () => {
    expect(findStateAcronym(states, "Narnia")).toBe("");
    expect(findStateAcronym(states, "Sin sigla")).toBe("");
    expect(findStateAcronym(states, "")).toBe("");
  });
});

describe("createDefaultGradeRows", () => {
  it("trae las siete áreas del formato, sin datos", () => {
    const rows = createDefaultGradeRows();
    expect(rows.map((r) => r.subjectName)).toEqual([...DEFAULT_CERTIFICATE_SUBJECTS]);
    expect(rows.some(isGradeRowFilled)).toBe(false);
    expect(new Set(rows.map((r) => r.id)).size).toBe(7);
  });
});

describe("isGradeRowFilled", () => {
  it("solo el nombre no cuenta como fila llena", () => {
    expect(isGradeRowFilled(createGradeRow({ subjectName: "CASTELLANO" }))).toBe(false);
    expect(isGradeRowFilled(createGradeRow({ subjectName: "CASTELLANO", grade: "14" }))).toBe(true);
    expect(isGradeRowFilled(createGradeRow({ evaluationType: " " }))).toBe(false);
  });
});

describe("applyToYearRows", () => {
  it("escribe solo los campos indicados en todas las filas", () => {
    const rows = [createGradeRow({ subjectName: "A", grade: "10", month: "01" }), createGradeRow({ subjectName: "B" })];
    const result = applyToYearRows(rows, { month: "07", year: "2024", institutionId: "x" });
    expect(result.map((r) => [r.subjectName, r.grade, r.month, r.year, r.institutionId])).toEqual([
      ["A", "10", "07", "2024", "x"],
      ["B", "", "07", "2024", "x"],
    ]);
  });
});

describe("instituciones", () => {
  const withThree = () => {
    let doc = emptyGradeCertificate();
    for (const name of ["UNO", "DOS", "TRES"]) doc = addInstitution(doc, { name });
    return doc;
  };

  it("numera por posición", () => {
    const doc = withThree();
    expect(institutionNumber(doc.institutions, doc.institutions[1].id)).toBe(2);
    expect(institutionNumber(doc.institutions, "no-existe")).toBeNull();
    expect(institutionNumber(doc.institutions, null)).toBeNull();
  });

  it("no agrega más de cinco", () => {
    let doc = withThree();
    for (const name of ["CUATRO", "CINCO", "SEIS"]) doc = addInstitution(doc, { name });
    expect(doc.institutions.map((i) => i.name)).toEqual(["UNO", "DOS", "TRES", "CUATRO", "CINCO"]);
  });

  it("al quitar una, limpia las notas que la usaban", () => {
    let doc = withThree();
    const [first, second] = doc.institutions;
    doc = updateYearRecord(doc, 2, (y) => ({
      ...y,
      grades: [createGradeRow({ institutionId: first.id }), createGradeRow({ institutionId: second.id })],
    }));
    expect(countGradesOfInstitution(doc, first.id)).toBe(1);

    const result = removeInstitution(doc, first.id);
    expect(result.institutions.map((i) => i.name)).toEqual(["DOS", "TRES"]);
    expect(result.yearRecords[1].grades.map((g) => g.institutionId)).toEqual([null, second.id]);
    // The remaining institution moved up to N° 1 and its grade still points to it.
    expect(institutionNumber(result.institutions, second.id)).toBe(1);
  });

  it("mueve una institución sin salirse de la lista", () => {
    const doc = withThree();
    const [first, , third] = doc.institutions;
    expect(moveInstitution(doc, third.id, "up").institutions.map((i) => i.name)).toEqual(["UNO", "TRES", "DOS"]);
    expect(moveInstitution(doc, first.id, "up")).toBe(doc);
    expect(moveInstitution(doc, third.id, "down")).toBe(doc);
  });
});

describe("buildOwnSchoolInstitution", () => {
  const header = { nombre_plantel: "Unidad Educativa Humboldt", municipio_plantel: "Maturin", entidad_federal: "Monagas" };

  it("usa los Datos comunes en mayúsculas y la sigla del estado", () => {
    expect(buildOwnSchoolInstitution(header, "mo")).toEqual({
      name: "UNIDAD EDUCATIVA HUMBOLDT",
      locality: "MATURIN",
      federalEntity: "MO",
      isOwnSchool: true,
    });
  });

  it("sin sigla usa las dos primeras letras del estado", () => {
    expect(buildOwnSchoolInstitution(header, null).federalEntity).toBe("MO");
    expect(buildOwnSchoolInstitution({}, null)).toEqual({ name: "", locality: "", federalEntity: "", isOwnSchool: true });
  });
});
