// Utilidades para calcular vencimiento real de un concepto de plan de pago
// dentro del año escolar (year_range tipo "2024-2025").
// Asume que un año escolar empieza en agosto del primer año por defecto.

const SCHOOL_YEAR_START_MONTH = 8; // Agosto = inicio típico de año escolar en Venezuela

function parseYearRange(yearRange?: string | null): { startYear: number; endYear: number } | null {
  if (!yearRange) return null;
  const m = yearRange.match(/(\d{4}).*?(\d{4})/);
  if (!m) return null;
  return { startYear: parseInt(m[1], 10), endYear: parseInt(m[2], 10) };
}

/**
 * Calcula la fecha real de vencimiento del concepto.
 * - Si tiene due_month: usa (year, due_month, due_day) eligiendo el año correcto del rango escolar.
 * - Si es recurrente sin due_month: usa due_day del mes en curso.
 * - Si no tiene due_day ni due_month: retorna null (sin vencimiento definido).
 */
export function computeDueDate(
  planConcept: { due_day?: number | null; due_month?: number | null; is_recurring?: boolean | null } | null | undefined,
  yearRange?: string | null,
  reference: Date = new Date(),
): Date | null {
  if (!planConcept) return null;
  const day = planConcept.due_day ?? null;
  const month = planConcept.due_month ?? null;

  if (month) {
    const range = parseYearRange(yearRange);
    const year = range
      ? (month >= SCHOOL_YEAR_START_MONTH ? range.startYear : range.endYear)
      : reference.getFullYear();
    const d = day ?? lastDayOfMonth(year, month);
    return new Date(year, month - 1, d, 23, 59, 59);
  }

  if (planConcept.is_recurring && day) {
    return new Date(reference.getFullYear(), reference.getMonth(), day, 23, 59, 59);
  }

  if (day && !planConcept.is_recurring) {
    // Sin mes pero con día: tomar el mes actual como referencia (compatibilidad legacy).
    return new Date(reference.getFullYear(), reference.getMonth(), day, 23, 59, 59);
  }

  return null;
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Indica si un balance pendiente está vencido a la fecha de referencia.
 * Si no hay vencimiento definido, NO se considera moroso.
 */
export function isOverdue(
  planConcept: { due_day?: number | null; due_month?: number | null; is_recurring?: boolean | null } | null | undefined,
  yearRange?: string | null,
  reference: Date = new Date(),
): boolean {
  const due = computeDueDate(planConcept, yearRange, reference);
  if (!due) return false;
  return reference.getTime() > due.getTime();
}
