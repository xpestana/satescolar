/**
 * Display name helpers for families.
 *
 * `families.father_last_name` / `mother_last_name` are nullable and in practice
 * often empty, so the family surname falls back to the **primary representative's**
 * apellidos and, when the family has no representative registered, to the
 * **student's** apellidos. See docs/desc/03-familias-y-representantes.md.
 */

/** Apellidos desde un `form_data` de representante/estudiante (soporta claves ES/EN). */
export function personSurname(formData: any): string {
  const fd = formData || {};
  const primero = fd.primer_apellido || fd.last_name || fd.apellido || "";
  return [primero, fd.segundo_apellido].filter(Boolean).join(" ").trim();
}

/** @deprecated Usar `personSurname`. Se mantiene por compatibilidad. */
export const repSurname = personSurname;

/**
 * Apellidos de la familia sin texto de respaldo: apellidos propios → apellidos del
 * representante principal → apellidos del estudiante. Devuelve `""` si no hay ninguno.
 */
export function resolveFamilySurname(
  family: any,
  primaryRepFormData?: any,
  studentFormData?: any,
): string {
  const own = [family?.father_last_name, family?.mother_last_name].filter(Boolean).join(" ").trim();
  if (own) return own;
  return personSurname(primaryRepFormData) || personSurname(studentFormData);
}

/**
 * Family surname to display, con `"Sin apellidos"` como último recurso.
 */
export function familySurname(
  family: any,
  primaryRepFormData?: any,
  studentFormData?: any,
): string {
  return resolveFamilySurname(family, primaryRepFormData, studentFormData) || "Sin apellidos";
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
