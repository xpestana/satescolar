import { describe, expect, it } from "vitest";
import {
  type SyncSourceEnrollment,
  type SyncSourceSubject,
  applySync,
  buildSyncCandidates,
  defaultSyncSelection,
} from "./grade-certificate-sync";
import {
  addInstitution,
  createGradeRow,
  emptyGradeCertificate,
  updateYearRecord,
} from "./grade-certificate";

const OWN_SCHOOL = { name: "U.E. HUMBOLDT", locality: "MATURIN", federalEntity: "MO", isOwnSchool: true };

function subject(overrides: Partial<SyncSourceSubject> & Pick<SyncSourceSubject, "subjectId" | "name">): SyncSourceSubject {
  return { subjectType: "regular", evaluationType: "numeric", gradeValue: null, adjustmentPoints: 0, ...overrides };
}

function enrollment(overrides: Partial<SyncSourceEnrollment> = {}): SyncSourceEnrollment {
  return {
    enrollmentId: "e1",
    gradeLevel: "1_ano",
    sectionName: "A",
    yearRange: "2024-2025",
    subjects: [
      subject({ subjectId: "s-cas", name: "Castellano", gradeValue: "13.6" }),
      subject({ subjectId: "s-mat", name: "Matemática", gradeValue: "8", adjustmentPoints: 1 }),
    ],
    ...overrides,
  };
}

describe("buildSyncCandidates", () => {
  it("formatea la nota como el Resumen Final y usa el año de cierre", () => {
    const [group] = buildSyncCandidates([enrollment()], emptyGradeCertificate());
    expect(group).toMatchObject({ yearLevel: 1, yearRange: "2024-2025", gradeYear: "2025", isLatestForLevel: true });
    expect(group.candidates.map((c) => [c.key, c.name, c.value, c.status])).toEqual([
      ["e1:s-cas", "CASTELLANO", "14", "new"],
      ["e1:s-mat", "MATEMÁTICA", "09", "new"],
    ]);
  });

  it("deja fuera 6to año, innovación productiva y tipos desconocidos", () => {
    const groups = buildSyncCandidates([
      enrollment({ enrollmentId: "e6", gradeLevel: "6_ano" }),
      enrollment({
        subjects: [
          subject({ subjectId: "s-inn", name: "Innovación", subjectType: "innovacion_tecnologica_productiva", gradeValue: "15" }),
          subject({ subjectId: "s-x", name: "Otra", subjectType: "desconocido", gradeValue: "15" }),
        ],
      }),
    ], emptyGradeCertificate());
    expect(groups).toHaveLength(1);
    expect(groups[0].candidates).toEqual([]);
  });

  it("marca sin definitiva la materia que no tiene nota", () => {
    const [group] = buildSyncCandidates(
      [enrollment({ subjects: [subject({ subjectId: "s-cas", name: "Castellano" })] })],
      emptyGradeCertificate(),
    );
    expect(group.candidates[0]).toMatchObject({ value: "", status: "no_grade" });
  });

  it("compara con el borrador: sin cambios, actualiza o nueva", () => {
    const draft = updateYearRecord(emptyGradeCertificate(), 1, (y) => ({
      ...y,
      grades: [
        createGradeRow({ subjectName: "CASTELLANO", grade: "14", month: "07", year: "2025", sourceSubjectId: "s-cas" }),
        // Typed by hand with another spelling: matches by name.
        createGradeRow({ subjectName: "matematica", grade: "12" }),
      ],
    }));
    const [group] = buildSyncCandidates([
      enrollment({
        subjects: [
          subject({ subjectId: "s-cas", name: "Castellano", gradeValue: "14" }),
          subject({ subjectId: "s-mat", name: "Matemática", gradeValue: "9" }),
          subject({ subjectId: "s-ing", name: "Inglés", gradeValue: "18" }),
        ],
      }),
    ], draft);
    expect(group.candidates.map((c) => [c.name, c.status, c.currentValue])).toEqual([
      ["CASTELLANO", "unchanged", "14"],
      ["MATEMÁTICA", "update", "12"],
      ["INGLÉS", "new", ""],
    ]);
  });

  it("reconoce una materia renombrada a mano por su vínculo y avisa que la actualizará", () => {
    const draft = updateYearRecord(emptyGradeCertificate(), 1, (y) => ({
      ...y,
      grades: [createGradeRow({ subjectName: "LENGUA", grade: "14", month: "07", year: "2025", sourceSubjectId: "s-cas" })],
    }));
    const [group] = buildSyncCandidates(
      [enrollment({ subjects: [subject({ subjectId: "s-cas", name: "Castellano", gradeValue: "14" })] })],
      draft,
    );
    expect(group.candidates[0]).toMatchObject({ status: "update", currentName: "LENGUA", name: "CASTELLANO" });
  });

  it("orientación y grupo salen como literales, uno por inscripción", () => {
    const [group] = buildSyncCandidates([
      enrollment({
        subjects: [
          subject({ subjectId: "s-ori", name: "Orientación y Convivencia", subjectType: "orientacion", evaluationType: "literal", gradeValue: "17" }),
          subject({ subjectId: "s-g1", name: "Semillero Científico", subjectType: "gcrp", evaluationType: "literal", gradeValue: "B" }),
          subject({ subjectId: "s-g2", name: "Ajedrez", subjectType: "gcrp", gradeValue: null }),
        ],
      }),
    ], emptyGradeCertificate());
    expect(group.candidates.map((c) => [c.key, c.kind, c.name, c.value, c.status])).toEqual([
      ["e1:orientation", "orientation", "ORIENTACIÓN Y CONVIVENCIA", "B", "new"],
      ["e1:group", "group", "SEMILLERO CIENTÍFICO, AJEDREZ", "B", "new"],
    ]);
  });

  it("ordena por año y marca la inscripción más reciente de un año repetido", () => {
    const groups = buildSyncCandidates([
      enrollment({ enrollmentId: "e2", gradeLevel: "2_ano", yearRange: "2025-2026" }),
      enrollment({ enrollmentId: "e1b", gradeLevel: "1_ano", yearRange: "2024-2025" }),
      enrollment({ enrollmentId: "e1a", gradeLevel: "1_ano", yearRange: "2023-2024" }),
    ], emptyGradeCertificate());
    expect(groups.map((g) => [g.enrollmentId, g.isLatestForLevel])).toEqual([
      ["e1a", false],
      ["e1b", true],
      ["e2", true],
    ]);
  });
});

describe("defaultSyncSelection", () => {
  it("preselecciona lo nuevo y lo que cambia, solo de la inscripción más reciente", () => {
    const draft = updateYearRecord(emptyGradeCertificate(), 1, (y) => ({
      ...y,
      grades: [createGradeRow({ subjectName: "CASTELLANO", grade: "14", month: "07", year: "2025", sourceSubjectId: "s-cas" })],
    }));
    const groups = buildSyncCandidates([
      enrollment({ enrollmentId: "old", yearRange: "2023-2024" }),
      enrollment({
        subjects: [
          subject({ subjectId: "s-cas", name: "Castellano", gradeValue: "14" }),
          subject({ subjectId: "s-mat", name: "Matemática", gradeValue: "9" }),
          subject({ subjectId: "s-ing", name: "Inglés" }),
        ],
      }),
    ], draft);
    expect([...defaultSyncSelection(groups)]).toEqual(["e1:s-mat"]);
  });
});

describe("applySync", () => {
  it("sin selección devuelve el mismo borrador", () => {
    const draft = emptyGradeCertificate();
    const groups = buildSyncCandidates([enrollment()], draft);
    expect(applySync(draft, groups, [], OWN_SCHOOL)).toBe(draft);
  });

  it("agrega solo las materias elegidas, con el plantel, mes 07, año de cierre y T-E F", () => {
    const draft = emptyGradeCertificate();
    const groups = buildSyncCandidates([enrollment()], draft);
    const result = applySync(draft, groups, ["e1:s-cas"], OWN_SCHOOL);

    expect(result.institutions).toHaveLength(1);
    expect(result.institutions[0]).toMatchObject(OWN_SCHOOL);
    expect(result.yearRecords[0].grades).toHaveLength(1);
    expect(result.yearRecords[0].grades[0]).toMatchObject({
      subjectName: "CASTELLANO",
      grade: "14",
      evaluationType: "F",
      month: "07",
      year: "2025",
      institutionId: result.institutions[0].id,
      sourceSubjectId: "s-cas",
    });
    expect(result.yearRecords.slice(1).every((y) => y.grades.length === 0)).toBe(true);
  });

  it("usa el plantel propio que ya existe en lugar de crear otro", () => {
    let draft = addInstitution(emptyGradeCertificate(), { name: "OTRO PLANTEL" });
    draft = addInstitution(draft, { name: "MI PLANTEL EDITADO", isOwnSchool: true });
    const groups = buildSyncCandidates([enrollment()], draft);
    const result = applySync(draft, groups, ["e1:s-cas"], OWN_SCHOOL);

    expect(result.institutions.map((i) => i.name)).toEqual(["OTRO PLANTEL", "MI PLANTEL EDITADO"]);
    expect(result.yearRecords[0].grades[0].institutionId).toBe(draft.institutions[1].id);
  });

  it("pisa nombre y nota de la materia que coincide y conserva el T-E escrito", () => {
    const manual = createGradeRow({ subjectName: "matematica", grade: "12", evaluationType: "R", month: "09", year: "2025" });
    const untouched = createGradeRow({ subjectName: "FÍSICA", grade: "15" });
    const draft = updateYearRecord(emptyGradeCertificate(), 1, (y) => ({ ...y, grades: [manual, untouched] }));
    const groups = buildSyncCandidates([enrollment()], draft);
    const result = applySync(draft, groups, ["e1:s-mat"], OWN_SCHOOL);

    const [updated, other] = result.yearRecords[0].grades;
    expect(result.yearRecords[0].grades).toHaveLength(2);
    expect(updated).toMatchObject({
      id: manual.id,
      subjectName: "MATEMÁTICA",
      grade: "09",
      evaluationType: "R",
      month: "07",
      year: "2025",
      sourceSubjectId: "s-mat",
    });
    expect(other).toEqual(untouched);
  });

  it("vuelve al nombre del sistema la materia renombrada a mano", () => {
    const renamed = createGradeRow({ subjectName: "LENGUA", grade: "10", sourceSubjectId: "s-cas" });
    const draft = updateYearRecord(emptyGradeCertificate(), 1, (y) => ({ ...y, grades: [renamed] }));
    const groups = buildSyncCandidates([enrollment()], draft);
    const result = applySync(draft, groups, ["e1:s-cas"], OWN_SCHOOL);
    expect(result.yearRecords[0].grades).toHaveLength(1);
    expect(result.yearRecords[0].grades[0]).toMatchObject({ id: renamed.id, subjectName: "CASTELLANO", grade: "14" });
  });

  it("una materia sin definitiva trae el nombre pero no borra la nota escrita a mano", () => {
    const manual = createGradeRow({ subjectName: "CASTELLANO", grade: "11" });
    const draft = updateYearRecord(emptyGradeCertificate(), 1, (y) => ({ ...y, grades: [manual] }));
    const groups = buildSyncCandidates(
      [enrollment({ subjects: [subject({ subjectId: "s-cas", name: "Castellano" })] })],
      draft,
    );
    const result = applySync(draft, groups, ["e1:s-cas"], OWN_SCHOOL);
    expect(result.yearRecords[0].grades[0]).toMatchObject({ grade: "11", sourceSubjectId: "s-cas" });
  });

  it("orientación y grupo se escriben en el año, sin crear plantel", () => {
    const draft = emptyGradeCertificate();
    const groups = buildSyncCandidates([
      enrollment({
        gradeLevel: "2_ano",
        subjects: [
          subject({ subjectId: "s-ori", name: "Orientación", subjectType: "orientacion", gradeValue: "19" }),
          subject({ subjectId: "s-g1", name: "Semillero Científico", subjectType: "gcrp", gradeValue: "16" }),
        ],
      }),
    ], draft);
    const result = applySync(draft, groups, ["e1:orientation", "e1:group"], OWN_SCHOOL);
    expect(result.institutions).toEqual([]);
    expect(result.yearRecords[1]).toMatchObject({
      orientationLiteral: "A",
      groupName: "SEMILLERO CIENTÍFICO",
      groupLiteral: "B",
      grades: [],
    });
  });

  it("en un año repetido gana la inscripción más reciente", () => {
    const draft = emptyGradeCertificate();
    const groups = buildSyncCandidates([
      enrollment({ enrollmentId: "new", yearRange: "2024-2025", subjects: [subject({ subjectId: "s-cas", name: "Castellano", gradeValue: "15" })] }),
      enrollment({ enrollmentId: "old", yearRange: "2023-2024", subjects: [subject({ subjectId: "s-cas", name: "Castellano", gradeValue: "7" })] }),
    ], draft);
    const result = applySync(draft, groups, ["old:s-cas", "new:s-cas"], OWN_SCHOOL);
    expect(result.yearRecords[0].grades).toHaveLength(1);
    expect(result.yearRecords[0].grades[0]).toMatchObject({ grade: "15", year: "2025" });
  });

  it("no crea el plantel si ya hay cinco instituciones; la nota queda sin institución", () => {
    let draft = emptyGradeCertificate();
    for (let i = 1; i <= 5; i++) draft = addInstitution(draft, { name: `PLANTEL ${i}` });
    const groups = buildSyncCandidates([enrollment()], draft);
    const result = applySync(draft, groups, ["e1:s-cas"], OWN_SCHOOL);
    expect(result.institutions).toHaveLength(5);
    expect(result.yearRecords[0].grades[0].institutionId).toBeNull();
  });
});
