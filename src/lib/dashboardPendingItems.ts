export type PendingItemType = "warning" | "info";

export interface PendingItem {
  label: string;
  count: number;
  type: PendingItemType;
  link?: string;
}

/** Counts read from the school's data; year-scoped counts are null when there is no active year. */
export interface PendingCounts {
  hasActiveSchoolYear: boolean;
  sections: number;
  families: number;
  studentsNotEnrolled: number | null;
  teachersWithoutAssignments: number | null;
  subjectsWithoutTeacher: number | null;
}

export const PENDING_ITEM_LINKS = {
  schoolYearsSections: "/school/configuraciones/anos-secciones",
  families: "/registros/familias",
  enrollments: "/inscripciones",
  subjectAssignments: "/registros/asignacion-areas",
} as const;

/**
 * Turns the dashboard counts into the "Pendientes por Atender" list. Setup gaps (no active
 * year, no sections, no families) come first because the rest of the school depends on them.
 */
export function buildPendingItems(counts: PendingCounts, includeTeaching: boolean): PendingItem[] {
  const items: PendingItem[] = [];

  if (!counts.hasActiveSchoolYear) {
    items.push({
      label: "No hay un año escolar activo configurado",
      count: 1,
      type: "warning",
      link: PENDING_ITEM_LINKS.schoolYearsSections,
    });
  }

  if (counts.sections === 0) {
    items.push({
      label: "Falta agregar las secciones del colegio",
      count: 1,
      type: "warning",
      link: PENDING_ITEM_LINKS.schoolYearsSections,
    });
  }

  if (counts.families === 0) {
    items.push({
      label: "Falta registrar las familias del colegio",
      count: 1,
      type: "warning",
      link: PENDING_ITEM_LINKS.families,
    });
  }

  if (counts.studentsNotEnrolled) {
    items.push({
      label: "Alumnos registrados sin inscripción en el año activo",
      count: counts.studentsNotEnrolled,
      type: "warning",
      link: PENDING_ITEM_LINKS.enrollments,
    });
  }

  if (includeTeaching && counts.teachersWithoutAssignments) {
    items.push({
      label: "Docentes activos sin áreas asignadas en el año activo",
      count: counts.teachersWithoutAssignments,
      type: "warning",
      link: PENDING_ITEM_LINKS.subjectAssignments,
    });
  }

  if (includeTeaching && counts.subjectsWithoutTeacher) {
    items.push({
      label: "Áreas curriculares sin docente asignado",
      count: counts.subjectsWithoutTeacher,
      type: "info",
      link: PENDING_ITEM_LINKS.subjectAssignments,
    });
  }

  return items;
}
