import { describe, it, expect } from "vitest";
import { computeSubjectAreaTotals, type SubjectGradeRecord } from "./resumen-final-subject-totals";
import type { StudentDocxRow, SubjectCol } from "@/hooks/useResumenFinalDocxData";

const subj = (id: string, assignmentId: string, evaluationType = "numeric"): SubjectCol => ({
  id,
  name: "Materia",
  abbreviation: "MT",
  evaluationType,
  isGcrp: false,
  assignmentId,
  teacherName: "",
  teacherCedula: "",
});

const row = (nro: number, grades: Record<string, string>): StudentDocxRow => ({
  nro,
  cedula: "",
  apellidos: "",
  nombres: "",
  lugarNacimiento: "",
  entidadFederal: "",
  sexo: "",
  diaNac: "",
  mesNac: "",
  anioNac: "",
  grades,
  gpGrade: "",
  grupoName: "",
});

const rec = (
  student_id: string,
  assignment_id: string,
  grade_value: string,
  final_status: string | null,
  extra: Partial<SubjectGradeRecord> = {},
): [string, SubjectGradeRecord] => [
  `${student_id}:${assignment_id}`,
  {
    student_id,
    assignment_id,
    grade_value,
    adjustment_points: 0,
    final_status,
    is_final_absentee: false,
    ...extra,
  },
];

describe("computeSubjectAreaTotals", () => {
  it("clasifica inscritos, no cursantes y aprobados por materia en la página", () => {
    const totals = computeSubjectAreaTotals(
      ["stu1", "stu2", "stu3"],
      [row(1, { a1: "12", a2: "" }), row(2, { a1: "08", a2: "15" }), row(3, { a1: "", a2: "11" })],
      [subj("s1", "a1"), subj("s2", "a2")],
      new Map([
        rec("stu1", "a1", "12", "aprobado"),
        rec("stu2", "a1", "8", "no_aprobado"),
        rec("stu2", "a2", "15", "aprobado"),
        rec("stu3", "a2", "11", "aprobado"),
      ]),
    );

    expect(totals.a1).toEqual({
      inscritos: 2,
      inasistentes: 0,
      asistentes: 2,
      aprobados: 1,
      noAprobados: 1,
      noCursantes: 1,
    });
    expect(totals.a2).toEqual({
      inscritos: 2,
      inasistentes: 0,
      asistentes: 2,
      aprobados: 2,
      noAprobados: 0,
      noCursantes: 1,
    });
  });
});

describe("computeSubjectAreaTotals — aprobados según el Estado de la definitiva", () => {
  it("cuenta con el Estado guardado, no con la nota", () => {
    // Nota 9 marcada Aprobado y nota 15 marcada No Aprobado: manda el Estado.
    const totals = computeSubjectAreaTotals(
      ["x", "y"],
      [row(1, { a1: "09" }), row(2, { a1: "15" })],
      [subj("s1", "a1")],
      new Map([rec("x", "a1", "9", "aprobado"), rec("y", "a1", "15", "no_aprobado")]),
    );
    expect(totals.a1.aprobados).toBe(1);
    expect(totals.a1.noAprobados).toBe(1);
  });

  it("sin Estado, No Cursante o PP no suman a Aprobados ni a No Aprobados", () => {
    const totals = computeSubjectAreaTotals(
      ["x", "y", "z"],
      [row(1, { a1: "18" }), row(2, { a1: "12" }), row(3, { a1: "10" })],
      [subj("s1", "a1")],
      new Map([rec("x", "a1", "18", null), rec("y", "a1", "12", "no_cursante"), rec("z", "a1", "10", "pp")]),
    );
    expect(totals.a1.inscritos).toBe(3);
    expect(totals.a1.aprobados).toBe(0);
    expect(totals.a1.noAprobados).toBe(0);
  });

  it("cuenta igual en materias de evaluación literal", () => {
    const totals = computeSubjectAreaTotals(
      ["x", "y", "z"],
      [row(1, { a1: "A" }), row(2, { a1: "D" }), row(3, { a1: "B" })],
      [subj("s1", "a1", "literal")],
      new Map([
        rec("x", "a1", "19", "aprobado"),
        rec("y", "a1", "7", "no_aprobado"),
        rec("z", "a1", "17", "aprobado"),
      ]),
    );
    expect(totals.a1.inscritos).toBe(3);
    expect(totals.a1.aprobados).toBe(2);
    expect(totals.a1.noAprobados).toBe(1);
  });
});

describe("computeSubjectAreaTotals — asistentes e inasistentes por estudiante", () => {
  it("cada inscrito es Asistente salvo que esté marcado Inasistente", () => {
    const totals = computeSubjectAreaTotals(
      ["x", "y", "z"],
      [row(1, { a1: "15" }), row(2, { a1: "12" }), row(3, { a1: "09" })],
      [subj("s1", "a1")],
      new Map([
        rec("x", "a1", "15", "aprobado"),
        rec("y", "a1", "12", "aprobado", { is_final_absentee: null }),
        rec("z", "a1", "9", "no_aprobado", { is_final_absentee: true }),
      ]),
    );
    expect(totals.a1.inscritos).toBe(3);
    expect(totals.a1.asistentes).toBe(2);
    expect(totals.a1.inasistentes).toBe(1);
  });

  it("un Inasistente sin nota cuenta como inscrito, no como no cursante", () => {
    const totals = computeSubjectAreaTotals(
      ["x", "y", "z"],
      [row(1, { a1: "15" }), row(2, { a1: "" }), row(3, { a1: "" })],
      [subj("s1", "a1")],
      new Map([rec("x", "a1", "15", "aprobado"), rec("y", "a1", "", null, { is_final_absentee: true })]),
    );
    expect(totals.a1).toEqual({
      inscritos: 2,
      asistentes: 1,
      inasistentes: 1,
      aprobados: 1,
      noAprobados: 0,
      noCursantes: 1,
    });
  });

  it("Inscritos siempre es Asistentes + Inasistentes", () => {
    const totals = computeSubjectAreaTotals(
      ["a", "b", "c", "d"],
      [row(1, { a1: "18" }), row(2, { a1: "10" }), row(3, { a1: "" }), row(4, { a1: "07" })],
      [subj("s1", "a1")],
      new Map([
        rec("a", "a1", "18", "aprobado"),
        rec("b", "a1", "10", null, { is_final_absentee: true }),
        rec("d", "a1", "7", "no_aprobado"),
      ]),
    );
    expect(totals.a1.inscritos).toBe(totals.a1.asistentes + totals.a1.inasistentes);
    expect(totals.a1.noCursantes).toBe(1);
  });
});
