/**
 * Fecha de remisión del Resumen Final (primaria y bachillerato 31059/31060).
 * Por defecto es el 31 de julio del año de cierre del año escolar; el colegio puede cambiarla
 * por sección y parte (`resumen_final_config.fecha_remision`, ISO "YYYY-MM-DD").
 */

/** Año de cierre del año escolar ("2025-2026" → "2026"); null si no se reconoce. */
function closingYear(yearRange: string): string | null {
  const m = String(yearRange ?? "").match(/(\d{4})\s*[-/]\s*(\d{4})/);
  return m ? m[2] : null;
}

/** Fecha por defecto en ISO para el input de fecha: "2025-2026" → "2026-07-31". */
export function defaultFechaRemisionIso(yearRange: string): string {
  const y = closingYear(yearRange);
  return y ? `${y}-07-31` : "";
}

/** "2026-08-15" → "15-08-2026"; lo que no sea una fecha ISO se devuelve recortado. */
export function isoToPlanillaDate(iso: string): string {
  const s = String(iso ?? "").trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : s;
}

/** Fecha que se imprime: la guardada o, si no hay, 31-07 del año de cierre. */
export function formatFechaRemision(saved: string | null | undefined, yearRange: string): string {
  const iso = String(saved ?? "").trim() || defaultFechaRemisionIso(yearRange);
  return isoToPlanillaDate(iso);
}
