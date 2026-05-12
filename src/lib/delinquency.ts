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
 * - Sin due_day ni due_month definidos: se considera vencido si hay saldo (legacy).
 * - Recurrente con due_day y sin due_month: vencido si al menos un mes del año
 *   escolar (desde agosto del año de inicio) ya completó su día de corte.
 * - Con due_month explícito: usa computeDueDate.
 */
export function isOverdue(
  planConcept: { due_day?: number | null; due_month?: number | null; is_recurring?: boolean | null } | null | undefined,
  yearRange?: string | null,
  reference: Date = new Date(),
): boolean {
  if (!planConcept) return true;
  const day = planConcept.due_day ?? null;
  const month = planConcept.due_month ?? null;

  // Legacy / sin vencimiento definido: tratar como vencido para no ocultar deudas.
  if (!day && !month) return true;

  // Recurrente sin mes específico: revisar todos los meses del año escolar hasta hoy.
  if (planConcept.is_recurring && day && !month) {
    const range = parseYearRange(yearRange);
    const startYear = range?.startYear ?? reference.getFullYear();
    const endYear = range?.endYear ?? reference.getFullYear();
    // Recorre desde agosto del startYear hasta el mes/año de la fecha de referencia.
    let y = startYear;
    let m = SCHOOL_YEAR_START_MONTH;
    const refY = reference.getFullYear();
    const refM = reference.getMonth() + 1;
    while (y < refY || (y === refY && m <= refM)) {
      const cutoff = new Date(y, m - 1, day, 23, 59, 59);
      if (reference.getTime() > cutoff.getTime()) return true;
      m += 1;
      if (m > 12) { m = 1; y += 1; }
      if (y > endYear + 1) break; // safeguard
    }
    return false;
  }

  const due = computeDueDate(planConcept, yearRange, reference);
  if (!due) return true;
  return reference.getTime() > due.getTime();
}
