/**
 * Display names for students and representatives.
 *
 * Names are not columns: they live inside the dynamic `form_data` JSON of `students` /
 * `representatives`, whose keys changed over time (`primer_nombre` today, `nombre`/`apellido` in
 * older records), so every screen has to apply the same fallbacks.
 */

export type PersonFormData = Record<string, unknown> | null | undefined;

const FALLBACK = "Sin nombre";

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function firstNames(formData: PersonFormData): string {
  const fd = formData ?? {};
  return [text(fd.primer_nombre) || text(fd.nombre), text(fd.segundo_nombre)]
    .filter(Boolean)
    .join(" ");
}

function lastNames(formData: PersonFormData): string {
  const fd = formData ?? {};
  return [text(fd.primer_apellido) || text(fd.apellido), text(fd.segundo_apellido)]
    .filter(Boolean)
    .join(" ");
}

/** "Nombres Apellidos" — natural reading order, for headings and documents. */
export function studentFullName(formData: PersonFormData): string {
  return [firstNames(formData), lastNames(formData)].filter(Boolean).join(" ") || FALLBACK;
}

/** "Apellidos Nombres" — for alphabetical lists, matching the grade sheets. */
export function studentListName(formData: PersonFormData): string {
  return [lastNames(formData), firstNames(formData)].filter(Boolean).join(" ") || FALLBACK;
}
