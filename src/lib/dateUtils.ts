/**
 * Utilidades de fecha para evitar corrimientos de zona horaria.
 *
 * Las fechas de pago (payment_date) se guardan como cadenas "YYYY-MM-DD"
 * (fecha calendario, sin hora). El error clásico es hacer
 * `new Date("2026-07-01")`, que JavaScript interpreta como medianoche UTC;
 * al convertir a la hora local de Venezuela (UTC-4) retrocede al día anterior
 * (30/6/2026). Estas funciones tratan las fechas como fecha calendario pura.
 */

const CARACAS_TZ = "America/Caracas";

/** Fecha de hoy en Venezuela como "YYYY-MM-DD" (sin corrimiento UTC). */
export function todayCaracasIso(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: CARACAS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

/**
 * Convierte un timestamp completo (p.ej. `created_at` con hora/zona) a la fecha
 * calendario en Venezuela "YYYY-MM-DD". A diferencia de `payment_date` (que ya es
 * fecha calendario pura), `created_at` es un instante y su fecha local depende de
 * la zona horaria — por eso no se puede comparar como texto directamente.
 */
export function caracasDateFromTimestamp(value: string | null | undefined): string {
  if (!value) return "";
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: CARACAS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date(value));
}

/**
 * Formatea una fecha calendario ("YYYY-MM-DD" o ISO completo) como "d/m/yyyy"
 * sin aplicar corrimiento de zona horaria. Devuelve "" si la entrada es vacía.
 */
export function formatDateOnly(value: string | null | undefined): string {
  if (!value) return "";
  // Tomamos solo la parte de fecha (los primeros 10 caracteres) para ignorar
  // cualquier componente de hora/zona y evitar el corrimiento de día.
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  return `${Number(day)}/${Number(month)}/${year}`;
}

/**
 * Convierte una fecha calendario "YYYY-MM-DD" a un objeto Date en horario
 * local (medianoche local), útil cuando se necesita un Date para formateo
 * posterior sin que se pierda un día por interpretación UTC.
 */
export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}
