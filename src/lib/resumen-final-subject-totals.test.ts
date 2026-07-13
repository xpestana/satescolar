import { describe, it, expect } from "vitest";
import { computeSubjectAreaTotals } from "./resumen-final-subject-totals";
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

describe("computeSubjectAreaTotals", () => {
  it("clasifica inscritos, no cursantes y aprobados por materia en la página", () => {
    const subjects = [subj("s1", "a1"), subj("s2", "a2")];
    const pageStudentIds = ["stu1", "stu2", "stu3"];
    const studentRows: StudentDocxRow[] = [
      {
        nro: 1,
        cedula: "",
        apellidos: "",
        nombres: "",
        lugarNacimiento: "",
        entidadFederal: "",
        sexo: "",
        diaNac: "",
        mesNac: "",
        anioNac: "",
        grades: { a1: "12", a2: "" },
      },
      {
        nro: 2,
        cedula: "",
        apellidos: "",
        nombres: "",
        lugarNacimiento: "",
        entidadFederal: "",
        sexo: "",
        diaNac: "",
        mesNac: "",
        anioNac: "",
        grades: { a1: "8", a2: "15" },
      },
      {
        nro: 3,
        cedula: "",
        apellidos: "",
        nombres: "",
        lugarNacimiento: "",
        entidadFederal: "",
        sexo: "",
        diaNac: "",
        mesNac: "",
        anioNac: "",
        grades: { a1: "", a2: "11" },
      },
    ];
    const gradeMap = new Map([
      [
        "stu1:a1",
        {
          student_id: "stu1",
          assignment_id: "a1",
          grade_value: "12",
          adjustment_points: 0,
          final_status: null,
          absence_count: 2,
          attendance_count: 10,
        },
      ],
      [
        "stu2:a1",
        {
          student_id: "stu2",
          assignment_id: "a1",
          grade_value: "8",
          adjustment_points: 0,
          final_status: null,
          absence_count: 1,
          attendance_count: 5,
        },
      ],
      [
        "stu2:a2",
        {
          student_id: "stu2",
          assignment_id: "a2",
          grade_value: "15",
          adjustment_points: 0,
          final_status: null,
          absence_count: 0,
          attendance_count: 8,
        },
      ],
      [
        "stu3:a2",
        {
          student_id: "stu3",
          assignment_id: "a2",
          grade_value: "11",
          adjustment_points: 0,
          final_status: null,
          absence_count: 3,
          attendance_count: 7,
        },
      ],
    ]);

    const totals = computeSubjectAreaTotals(pageStudentIds, studentRows, subjects, gradeMap);

    expect(totals.a1).toEqual({
      inscritos: 2,
      inasistentes: 3,
      asistentes: 15,
      aprobados: 1,
      noAprobados: 1,
      noCursantes: 1,
    });
    expect(totals.a2).toEqual({
      inscritos: 2,
      inasistentes: 3,
      asistentes: 15,
      aprobados: 2,
      noAprobados: 0,
      noCursantes: 1,
    });
  });

  it("10 es aprobado; 9 y menos es no aprobado", () => {
    const subjects = [subj("s1", "a1")];
    const pageStudentIds = ["s10", "s9", "s99"];
    const studentRows: StudentDocxRow[] = [
      {
        nro: 1,
        cedula: "",
        apellidos: "",
        nombres: "",
        lugarNacimiento: "",
        entidadFederal: "",
        sexo: "",
        diaNac: "",
        mesNac: "",
        anioNac: "",
        grades: { a1: "10" },
      },
      {
        nro: 2,
        cedula: "",
        apellidos: "",
        nombres: "",
        lugarNacimiento: "",
        entidadFederal: "",
        sexo: "",
        diaNac: "",
        mesNac: "",
        anioNac: "",
        grades: { a1: "9" },
      },
      {
        nro: 3,
        cedula: "",
        apellidos: "",
        nombres: "",
        lugarNacimiento: "",
        entidadFederal: "",
        sexo: "",
        diaNac: "",
        mesNac: "",
        anioNac: "",
        grades: { a1: "9.9" },
      },
    ];
    const gradeMap = new Map([
      [
        "s10:a1",
        {
          student_id: "s10",
          assignment_id: "a1",
          grade_value: "10",
          adjustment_points: 0,
          final_status: null,
          absence_count: 0,
          attendance_count: 0,
        },
      ],
      [
        "s9:a1",
        {
          student_id: "s9",
          assignment_id: "a1",
          grade_value: "9",
          adjustment_points: 0,
          final_status: null,
          absence_count: 0,
          attendance_count: 0,
        },
      ],
      [
        "s99:a1",
        {
          student_id: "s99",
          assignment_id: "a1",
          grade_value: "9.9",
          adjustment_points: 0,
          final_status: null,
          absence_count: 0,
          attendance_count: 0,
        },
      ],
    ]);

    const totals = computeSubjectAreaTotals(pageStudentIds, studentRows, subjects, gradeMap);

    expect(totals.a1.aprobados).toBe(1);
    expect(totals.a1.noAprobados).toBe(2);
  });

  it("nota 9 + ajuste 1 cuenta como aprobado (definitiva 10)", () => {
    const subjects = [subj("s1", "a1")];
    const pageStudentIds = ["s1"];
    const studentRows: StudentDocxRow[] = [
      {
        nro: 1,
        cedula: "",
        apellidos: "",
        nombres: "",
        lugarNacimiento: "",
        entidadFederal: "",
        sexo: "",
        diaNac: "",
        mesNac: "",
        anioNac: "",
        grades: { a1: "10" },
      },
    ];
    const gradeMap = new Map([
      [
        "s1:a1",
        {
          student_id: "s1",
          assignment_id: "a1",
          grade_value: "9",
          adjustment_points: 1,
          final_status: null,
          absence_count: 0,
          attendance_count: 0,
        },
      ],
    ]);

    const totals = computeSubjectAreaTotals(pageStudentIds, studentRows, subjects, gradeMap);
    expect(totals.a1.aprobados).toBe(1);
    expect(totals.a1.noAprobados).toBe(0);
  });
});
