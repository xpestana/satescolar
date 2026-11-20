import { describe, expect, it } from "vitest";
import { buildPendingItems, PENDING_ITEM_LINKS, type PendingCounts } from "./dashboardPendingItems";

const configuredSchool: PendingCounts = {
  hasActiveSchoolYear: true,
  sections: 12,
  families: 40,
  studentsNotEnrolled: 0,
  teachersWithoutAssignments: 0,
  subjectsWithoutTeacher: 0,
};

describe("buildPendingItems", () => {
  it("devuelve una lista vacía cuando el colegio está configurado y al día", () => {
    expect(buildPendingItems(configuredSchool, true)).toEqual([]);
  });

  it("en un colegio nuevo pide año activo, secciones y familias, en ese orden", () => {
    const items = buildPendingItems(
      {
        hasActiveSchoolYear: false,
        sections: 0,
        families: 0,
        studentsNotEnrolled: null,
        teachersWithoutAssignments: null,
        subjectsWithoutTeacher: null,
      },
      true,
    );

    expect(items.map((i) => i.label)).toEqual([
      "No hay un año escolar activo configurado",
      "Falta agregar las secciones del colegio",
      "Falta registrar las familias del colegio",
    ]);
    expect(items.map((i) => i.link)).toEqual([
      PENDING_ITEM_LINKS.schoolYearsSections,
      PENDING_ITEM_LINKS.schoolYearsSections,
      PENDING_ITEM_LINKS.families,
    ]);
  });

  it("avisa de secciones aunque ya haya año activo", () => {
    const items = buildPendingItems({ ...configuredSchool, sections: 0 }, true);
    expect(items).toEqual([
      {
        label: "Falta agregar las secciones del colegio",
        count: 1,
        type: "warning",
        link: "/school/configuraciones/anos-secciones",
      },
    ]);
  });

  it("avisa de familias cuando no hay ninguna registrada", () => {
    const items = buildPendingItems({ ...configuredSchool, families: 0 }, true);
    expect(items).toEqual([
      {
        label: "Falta registrar las familias del colegio",
        count: 1,
        type: "warning",
        link: "/registros/familias",
      },
    ]);
  });

  it("muestra los conteos del año activo con su enlace", () => {
    const items = buildPendingItems(
      { ...configuredSchool, studentsNotEnrolled: 5, teachersWithoutAssignments: 2, subjectsWithoutTeacher: 3 },
      true,
    );
    expect(items.map((i) => [i.count, i.type, i.link])).toEqual([
      [5, "warning", PENDING_ITEM_LINKS.enrollments],
      [2, "warning", PENDING_ITEM_LINKS.subjectAssignments],
      [3, "info", PENDING_ITEM_LINKS.subjectAssignments],
    ]);
  });

  it("omite los pendientes de docentes cuando el colegio no tiene módulos docentes", () => {
    const items = buildPendingItems(
      { ...configuredSchool, teachersWithoutAssignments: 2, subjectsWithoutTeacher: 3 },
      false,
    );
    expect(items).toEqual([]);
  });
});
