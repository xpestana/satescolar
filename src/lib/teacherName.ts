/** "Nombre Apellido" of a teacher from their form_data, as shown on screen and on signatures. */
export function teacherDisplayName(formData: unknown): string {
  const fd = (formData ?? {}) as Record<string, string | undefined>;
  return `${fd.nombre || fd.primer_nombre || ""} ${fd.apellido || fd.primer_apellido || ""}`.trim();
}
