/** Values of `school_subjects.subject_type`, in the order they are offered in the UI. */
export const SUBJECT_TYPES = [
  "regular",
  "gcrp",
  "orientacion",
  "innovacion_tecnologica_productiva",
] as const;

export type SubjectType = (typeof SUBJECT_TYPES)[number];

const SUBJECT_TYPE_LABELS: Record<SubjectType, string> = {
  regular: "Regular",
  gcrp: "GCRP",
  orientacion: "Orientación",
  innovacion_tecnologica_productiva: "Innovación Tecnológica Productiva",
};

const SUBJECT_TYPE_SHORT_LABELS: Record<SubjectType, string> = {
  regular: "Regular",
  gcrp: "GCRP",
  orientacion: "Orientación",
  innovacion_tecnologica_productiva: "ITP",
};

export function isSubjectType(value: unknown): value is SubjectType {
  return typeof value === "string" && (SUBJECT_TYPES as readonly string[]).includes(value);
}

/** Full Spanish label. Unknown or missing values fall back to "Regular", the column default. */
export function getSubjectTypeLabel(value: string | null | undefined): string {
  return isSubjectType(value) ? SUBJECT_TYPE_LABELS[value] : SUBJECT_TYPE_LABELS.regular;
}

/** Compact label for badges in dense tables. */
export function getSubjectTypeShortLabel(value: string | null | undefined): string {
  return isSubjectType(value) ? SUBJECT_TYPE_SHORT_LABELS[value] : SUBJECT_TYPE_SHORT_LABELS.regular;
}
