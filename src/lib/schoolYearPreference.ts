/**
 * Remembered school-year choice for the payment screens.
 *
 * Registro de Pagos, Morosos, Reporte de Pagos, Estado de cuenta and Ingresos let the user work
 * on a year other than the active one (e.g. charging 2025-2026 debts while 2026-2027 is already
 * active). Keeping that choice only in React state made every reload or navigation "bounce"
 * back to the active year, so it is stored in localStorage, scoped by `school_id` and shared by
 * all of those screens.
 *
 * Only a NON-active choice is stored: picking the active year clears the preference, so that
 * when the school activates a new year everybody follows it by default.
 */

export interface SchoolYearLike {
  id: string;
  is_active: boolean;
}

const STORAGE_PREFIX = "payments-school-year:";

const keyFor = (schoolId: string) => `${STORAGE_PREFIX}${schoolId}`;

/** Stored year id for the school, or `null` when there is none (or storage is unavailable). */
export function readPreferredSchoolYearId(schoolId: string): string | null {
  if (!schoolId) return null;
  try {
    return localStorage.getItem(keyFor(schoolId)) || null;
  } catch {
    return null;
  }
}

/**
 * Remember the year the user picked. Choosing the active year (or an unknown id) removes the
 * preference instead of storing it.
 */
export function rememberSchoolYearChoice(
  schoolId: string,
  yearId: string,
  years: SchoolYearLike[],
): void {
  if (!schoolId) return;
  const chosen = years.find((y) => y.id === yearId);
  try {
    if (!chosen || chosen.is_active) localStorage.removeItem(keyFor(schoolId));
    else localStorage.setItem(keyFor(schoolId), yearId);
  } catch {
    /* storage unavailable: the choice simply is not remembered */
  }
}

/**
 * Year to show: the remembered one if it still exists, otherwise the active year, otherwise the
 * first of the list (callers pass years sorted most-recent first). `null` for an empty list.
 */
export function resolveSchoolYearId(
  years: SchoolYearLike[],
  preferredId: string | null,
): string | null {
  if (years.length === 0) return null;
  if (preferredId && years.some((y) => y.id === preferredId)) return preferredId;
  return years.find((y) => y.is_active)?.id ?? years[0].id;
}
