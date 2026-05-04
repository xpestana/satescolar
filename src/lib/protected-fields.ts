// Campos críticos del sistema: están protegidos contra eliminación/ocultar
// y se tratan como requeridos en runtime (aunque is_required en BD esté en false).
// Esto no modifica BD; normaliza la regla en frontend para que funcione al mezclar en VPS.

export type ProtectedFormType = "student" | "representative" | "teacher";

export const PROTECTED_FIELDS: Record<ProtectedFormType, string[]> = {
  representative: [
    "tipo_documento", "documento", "cedula",
    "primer_nombre", "segundo_nombre", "nombres",
    "primer_apellido", "segundo_apellido", "apellidos",
    "fecha_nacimiento", "email", "correo_electronico",
  ],
  student: [
    "tipo_documento", "documento", "cedula", "cedula_escolar",
    "primer_nombre", "segundo_nombre", "nombres",
    "primer_apellido", "segundo_apellido", "apellidos",
    "fecha_nacimiento",
  ],
  teacher: [
    "tipo_documento", "documento", "cedula",
    "primer_nombre", "segundo_nombre", "nombres",
    "primer_apellido", "segundo_apellido", "apellidos",
    "fecha_nacimiento", "email", "correo_electronico",
  ],
};

export function isProtectedField(formType: ProtectedFormType, fieldName: string): boolean {
  const normalizedFieldName = fieldName.trim().toLowerCase();
  return PROTECTED_FIELDS[formType]?.includes(normalizedFieldName) ?? false;
}

export function isEffectivelyRequired(
  formType: ProtectedFormType,
  fieldName: string,
  isRequired: boolean,
): boolean {
  return isRequired || isProtectedField(formType, fieldName);
}
