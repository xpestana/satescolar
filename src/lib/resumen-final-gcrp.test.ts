import { describe, expect, it } from "vitest";
import { computeGpGradeAndGrupo } from "./resumen-final-gcrp";
import { resolvePlanEstudio } from "./resumen-final-plan-estudio";

const gcrpAssignments = [
  {
    id: "a-gcrp-1",
    school_subjects: {
      name: "Grupo Teatro",
      evaluation_type: "numeric",
    },
  },
  {
    id: "a-gcrp-2",
    school_subjects: {
      name: "Grupo Deportes",
      evaluation_type: "numeric",
    },
  },
];

describe("computeGpGradeAndGrupo", () => {
  it("promedia notas numéricas y concatena nombres de grupo", () => {
    const gradeMap = new Map([
      [
        "stu1:a-gcrp-1",
        {
          grade_value: "18",
          adjustment_points: 0,
          final_status: null,
        },
      ],
      [
        "stu1:a-gcrp-2",
        {
          grade_value: "16",
          adjustment_points: 0,
          final_status: null,
        },
      ],
    ]);

    const result = computeGpGradeAndGrupo(
      "stu1",
      ["a-gcrp-1", "a-gcrp-2"],
      gcrpAssignments,
      gradeMap,
      (sid, aid) => `${sid}:${aid}`,
    );

    expect(result.gpGrade).toBe("17");
    expect(result.grupoName).toBe("Grupo Teatro, Grupo Deportes");
  });

  it("usa literal cuando no hay notas numéricas", () => {
    const literalAssignments = [
      {
        id: "a-lit",
        school_subjects: {
          name: "Grupo Música",
          evaluation_type: "literal",
        },
      },
    ];
    const gradeMap = new Map([
      [
        "stu1:a-lit",
        {
          grade_value: "19",
          adjustment_points: 0,
          final_status: "A",
        },
      ],
    ]);

    const result = computeGpGradeAndGrupo(
      "stu1",
      ["a-lit"],
      literalAssignments,
      gradeMap,
      (sid, aid) => `${sid}:${aid}`,
    );

    expect(result.gpGrade).toBe("A");
    expect(result.grupoName).toBe("Grupo Música");
  });

  it("devuelve vacío sin asignaciones GCRP", () => {
    expect(
      computeGpGradeAndGrupo(
        "stu1",
        [],
        gcrpAssignments,
        new Map(),
        (sid, aid) => `${sid}:${aid}`,
      ),
    ).toEqual({ gpGrade: "", grupoName: "" });
  });
});

describe("resolvePlanEstudio", () => {
  it("31059 usa plan general y 31060 usa mención configurada", () => {
    expect(resolvePlanEstudio("31059", "CIENCIA Y TECNOLOGÍA")).toBe(
      "EDUCACIÓN MEDIA GENERAL",
    );
    expect(resolvePlanEstudio("31060", "CIENCIA Y TECNOLOGÍA")).toBe(
      "CIENCIA Y TECNOLOGÍA",
    );
    expect(resolvePlanEstudio("31060", "")).toBe("EDUCACIÓN MEDIA GENERAL");
  });
});
