// Shared utility for checking student data completeness against planilla sections

// These custom fields are filled automatically during enrollment and should be excluded from completeness checks
export const ENROLLMENT_CUSTOM_FIELDS = [
  "custom:tipo_de_estudiante",
  "custom:grupo_asignado",
  "custom:fecha_de_inscripcion",
];

export interface CompletenessResult {
  isComplete: boolean;
  missingStudentFields: string[];
  missingRepresentativeFields: string[];
  missingFamilyFields: string[];
}

/**
 * Checks if a student has all required planilla fields filled (excluding enrollment-specific fields).
 */
export function checkStudentCompleteness(
  planillaSections: { field_names: string[]; section_type: string }[],
  studentFormData: Record<string, string> | null,
  representativeFormData: Record<string, string> | null,
  familyData: Record<string, any> | null,
): CompletenessResult {
  const allFields: string[] = [];
  planillaSections.forEach(s => {
    if (s.section_type === "fields" && Array.isArray(s.field_names)) {
      s.field_names.forEach(f => {
        if (!ENROLLMENT_CUSTOM_FIELDS.includes(f) && !f.endsWith(":_edad")) {
          allFields.push(f);
        }
      });
    }
  });

  const missingStudentFields: string[] = [];
  const missingRepresentativeFields: string[] = [];
  const missingFamilyFields: string[] = [];

  allFields.forEach(field => {
    const [type, ...rest] = field.split(":");
    const name = rest.join(":");

    if (type === "student") {
      const value = studentFormData?.[name];
      if (!value || (typeof value === "string" && !value.trim())) {
        missingStudentFields.push(field);
      }
    } else if (type === "representative") {
      const value = representativeFormData?.[name];
      if (!value || (typeof value === "string" && !value.trim())) {
        missingRepresentativeFields.push(field);
      }
    } else if (type === "family") {
      const value = familyData?.[name];
      if (value === null || value === undefined || (typeof value === "string" && !value.trim())) {
        missingFamilyFields.push(field);
      }
    }
    // custom fields that are not enrollment-related: check in student form_data as fallback
    else if (type === "custom") {
      const value = studentFormData?.[name];
      if (!value || (typeof value === "string" && !value.trim())) {
        missingStudentFields.push(field);
      }
    }
  });

  return {
    isComplete: missingStudentFields.length === 0 && missingRepresentativeFields.length === 0 && missingFamilyFields.length === 0,
    missingStudentFields,
    missingRepresentativeFields,
    missingFamilyFields,
  };
}
