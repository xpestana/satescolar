/**
 * Display name helpers for families in the payments module.
 *
 * `families.father_last_name` / `mother_last_name` are nullable and in practice
 * often empty, so the family surname falls back to the **primary representative's**
 * apellidos (never the students'). See docs/desc/03-familias-y-representantes.md.
 */

/** Apellidos del representante desde su `form_data` (soporta claves ES/EN). */
export function repSurname(repFormData: any): string {
  const fd = repFormData || {};
  const primero = fd.primer_apellido || fd.last_name || fd.apellido || "";
  return [primero, fd.segundo_apellido].filter(Boolean).join(" ").trim();
}

/**
 * Family surname to display: the family's own last names if present, otherwise the
 * primary representative's apellidos, and "Sin apellidos" only as a last resort.
 */
export function familySurname(family: any, primaryRepFormData: any): string {
  const own = [family?.father_last_name, family?.mother_last_name].filter(Boolean).join(" ");
  if (own) return own;
  return repSurname(primaryRepFormData) || "Sin apellidos";
}

/**
 * Build a `family_id → representative form_data` map, preferring the `is_primary`
 * representative and falling back to the first one found for that family.
 */
export function buildPrimaryRepMap(representatives: any[]): Record<string, any> {
  const map: Record<string, any> = {};
  const hasPrimary: Record<string, boolean> = {};
  (representatives || []).forEach((r) => {
    if (r.is_primary) {
      map[r.family_id] = r.form_data;
      hasPrimary[r.family_id] = true;
    } else if (!hasPrimary[r.family_id] && map[r.family_id] === undefined) {
      map[r.family_id] = r.form_data;
    }
  });
  return map;
}
