/**
 * País de nacimiento del estudiante (`form_data.pais_nacimiento`). El formulario lo guarda como
 * texto ("Venezuela", "Colombia"…) y, si falta, asume Venezuela; aquí se sigue el mismo criterio.
 */

/** Entidad federal de quien nació fuera de Venezuela en las planillas del Ministerio. */
export const FOREIGN_ENTIDAD_FEDERAL = "EX";

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

/** Nació fuera de Venezuela: hay país de nacimiento y no es Venezuela. Sin país → false. */
export function isBornAbroad(formData: Record<string, unknown>): boolean {
  const country = formData.pais_nacimiento;
  if (typeof country !== "string" || !country.trim()) return false;
  return !normalize(country).includes("venezuela");
}
