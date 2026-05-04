// Campos "Obligatorios" del sistema: están protegidos contra eliminación/ocultar
// y se tratan como requeridos en runtime (aunque is_required en BD esté en false).
// Mantener sincronizado con FormFieldsEditor.tsx.

export type ProtectedFormType = "student" | "representative" | "teacher";

export const PROTECTED_FIELDS: Record<ProtectedFormType, string[]> = {
  representative: ["primer_nombre", "primer_apellido", "documento"],
  student: ["primer_nombre", "primer_apellido", "documento", "fecha_nacimiento"],
  teacher: [
    "primer_nombre", "segundo_nombre", "primer_apellido", "segundo_apellido",
    "documento", "fecha_nacimiento", "email", "correo_electronico",
  ],
};

export function isProtectedField(formType: ProtectedFormType, fieldName: string): boolean {
  return PROTECTED_FIELDS[formType]?.includes(fieldName) ?? false;
}

export function isEffectivelyRequired(
  formType: ProtectedFormType,
  fieldName: string,
  isRequired: boolean,
): boolean {
  return isRequired || isProtectedField(formType, fieldName);
}
