import { describe, expect, it } from "vitest";
import {
  type SourceAssignmentRow,
  type SourceEnrollmentRow,
  type SourceSubjectRow,
  buildSyncSource,
} from "./grade-certificate-sync-source";

const ENROLLMENT: SourceEnrollmentRow = {
  id: "e1",
  sectionId: "sec1",
  schoolYearId: "y1",
  gradeLevel: "1_ano",
  sectionName: "A",
  yearRange: "2024-2025",
};

function subject(overrides: Partial<SourceSubjectRow> = {}): SourceSubjectRow {
  return {
    name: "Castellano",
    display_order: 1,
    show_in_planilla: true,
    evaluation_type: "numeric",
    subject_type: "regular",
    is_suspended: false,
    ...overrides,
  };
}

function assignment(id: string, subjectId: string, overrides: Partial<SourceAssignmentRow> = {}): SourceAssignmentRow {
  return { id, subject_id: subjectId, section_id: "sec1", school_year_id: "y1", school_subjects: subject(), ...overrides };
}

describe("buildSyncSource", () => {
  it("arma las materias de la inscripción con su definitiva, por orden", () => {
    const [result] = buildSyncSource(
      [ENROLLMENT],
      [
        assignment("a2", "s-mat", { school_subjects: subject({ name: "Matemática", display_order: 2 }) }),
        assignment("a1", "s-cas"),
      ],
      [],
      [{ assignment_id: "a1", grade_value: "14", adjustment_points: 1 }],
    );
    expect(result).toMatchObject({ enrollmentId: "e1", gradeLevel: "1_ano", sectionName: "A", yearRange: "2024-2025" });
    expect(result.subjects).toEqual([
      { subjectId: "s-cas", name: "Castellano", subjectType: "regular", evaluationType: "numeric", gradeValue: "14", adjustmentPoints: 1 },
      { subjectId: "s-mat", name: "Matemática", subjectType: "regular", evaluationType: "numeric", gradeValue: null, adjustmentPoints: 0 },
    ]);
  });

  it("solo toma las asignaciones de la sección y el año de la inscripción", () => {
    const [result] = buildSyncSource(
      [ENROLLMENT],
      [
        assignment("a1", "s-cas"),
        assignment("a2", "s-otra-seccion", { section_id: "sec2" }),
        assignment("a3", "s-otro-anio", { school_year_id: "y2" }),
      ],
      [],
      [],
    );
    expect(result.subjects.map((s) => s.subjectId)).toEqual(["s-cas"]);
  });

  it("deja fuera materias suspendidas, ocultas de planilla o sin materia", () => {
    const [result] = buildSyncSource(
      [ENROLLMENT],
      [
        assignment("a1", "s-susp", { school_subjects: subject({ is_suspended: true }) }),
        assignment("a2", "s-oculta", { school_subjects: subject({ show_in_planilla: false }) }),
        assignment("a3", "s-nula", { school_subjects: null }),
        assignment("a4", "s-ok"),
      ],
      [],
      [],
    );
    expect(result.subjects.map((s) => s.subjectId)).toEqual(["s-ok"]);
  });

  it("si dos asignaciones comparten materia, usa la que tiene definitiva", () => {
    const [result] = buildSyncSource(
      [ENROLLMENT],
      [assignment("a1", "s-cas"), assignment("a2", "s-cas")],
      [],
      [{ assignment_id: "a2", grade_value: "17", adjustment_points: 0 }],
    );
    expect(result.subjects).toHaveLength(1);
    expect(result.subjects[0].gradeValue).toBe("17");
  });

  it("los grupos entran solo por el vínculo del estudiante y en su año escolar", () => {
    const gcrp = subject({ name: "Semillero", subject_type: "gcrp", evaluation_type: "literal" });
    const [result] = buildSyncSource(
      [ENROLLMENT],
      // A group assignment that happens to carry the section is ignored: no link, no group.
      [assignment("a-sec", "s-gcrp-seccion", { school_subjects: gcrp })],
      [
        assignment("a-g1", "s-gcrp", { section_id: null, school_subjects: gcrp }),
        assignment("a-g2", "s-gcrp-viejo", { section_id: null, school_year_id: "y0", school_subjects: gcrp }),
      ],
      [{ assignment_id: "a-g1", grade_value: "18", adjustment_points: 0 }],
    );
    expect(result.subjects).toEqual([
      { subjectId: "s-gcrp", name: "Semillero", subjectType: "gcrp", evaluationType: "literal", gradeValue: "18", adjustmentPoints: 0 },
    ]);
  });

  it("una nota en blanco cuenta como sin definitiva", () => {
    const [result] = buildSyncSource(
      [ENROLLMENT],
      [assignment("a1", "s-cas")],
      [],
      [{ assignment_id: "a1", grade_value: "  ", adjustment_points: null }],
    );
    expect(result.subjects[0]).toMatchObject({ gradeValue: null, adjustmentPoints: 0 });
  });

  it("sin inscripciones no hay nada que sincronizar", () => {
    expect(buildSyncSource([], [assignment("a1", "s-cas")], [], [])).toEqual([]);
  });
});
