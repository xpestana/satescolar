import { resolveGradeLevelKind } from "@/lib/gradeLevels";

export type GradeLevel =
  | "pre_maternal" | "maternal"
  | "i_nivel" | "ii_nivel" | "iii_nivel"
  | "1_grado" | "2_grado" | "3_grado" | "4_grado" | "5_grado" | "6_grado"
  | "1_ano" | "2_ano" | "3_ano" | "4_ano" | "5_ano" | "6_ano"
  // Legacy values (kept for backward compatibility)
  | "inicial" | "primaria" | "media_general" | "media_tecnica";

export interface SchoolSection {
  id: string;
  school_id: string;
  grade_level: GradeLevel;
  name: string;
  is_technical: boolean;
  technical_specialty: string | null;
}

export interface GradeCategory {
  category: string;
  levels: { value: GradeLevel; label: string }[];
}

/** A section waiting to be saved in the sections modal. */
export interface PendingSection {
  name: string;
  isTechnical: boolean;
  specialty: string;
}

export const GRADE_CATEGORIES: GradeCategory[] = [
  {
    category: "Pre-Maternal / Maternal",
    levels: [
      { value: "pre_maternal", label: "Pre-Maternal" },
      { value: "maternal", label: "Maternal" },
    ],
  },
  {
    category: "Inicial",
    levels: [
      { value: "i_nivel", label: "I Nivel" },
      { value: "ii_nivel", label: "II Nivel" },
      { value: "iii_nivel", label: "III Nivel" },
    ],
  },
  {
    category: "Primaria",
    levels: [
      { value: "1_grado", label: "1er Grado" },
      { value: "2_grado", label: "2do Grado" },
      { value: "3_grado", label: "3er Grado" },
      { value: "4_grado", label: "4to Grado" },
      { value: "5_grado", label: "5to Grado" },
      { value: "6_grado", label: "6to Grado" },
    ],
  },
  {
    // Media General and Media Técnica used to be two buttons; each section now says if it is técnica.
    category: "Secundaria",
    levels: [
      { value: "1_ano", label: "1er Año" },
      { value: "2_ano", label: "2do Año" },
      { value: "3_ano", label: "3er Año" },
      { value: "4_ano", label: "4to Año" },
      { value: "5_ano", label: "5to Año" },
      { value: "6_ano", label: "6to Año" },
    ],
  },
];

/** Categories that use one button per level instead of an accordion. */
export const DIRECT_CATEGORIES = ["Pre-Maternal / Maternal"];

const ALL_GRADE_LEVELS = GRADE_CATEGORIES.flatMap((c) => c.levels);

export function categoryGradeLabel(grade: GradeLevel): string {
  return ALL_GRADE_LEVELS.find((g) => g.value === grade)?.label || grade;
}

/** Only secondary (1er–6to Año) sections can be marked as técnica. */
export function gradeAllowsTechnical(grade: string): boolean {
  return resolveGradeLevelKind(grade) === "secondary";
}

/**
 * A letter can exist twice in the same grade: once as a regular section and once as a técnica
 * one ("1er Año - A" and "1er Año - A (Técnica)"). Mirrors the DB unique key
 * (school_id, grade_level, name, is_technical).
 */
export function isSectionTaken(
  gradeSections: { name: string; is_technical?: boolean | null }[],
  name: string,
  isTechnical: boolean,
): boolean {
  const normalized = name.trim().toUpperCase();
  return gradeSections.some((s) => s.name === normalized && !!s.is_technical === isTechnical);
}

export interface TechnicalFields {
  is_technical: boolean;
  technical_specialty: string | null;
}

export interface TechnicalFieldsResult {
  /** Message to show when the fields cannot be saved; `null` when they are valid. */
  error: string | null;
  fields: TechnicalFields;
}

const NON_TECHNICAL: TechnicalFields = { is_technical: false, technical_specialty: null };

/**
 * Columns to save for a section's técnica flag. A técnica section needs its specialty; a
 * non-técnica one (or a grade that cannot be técnica) always stores `false` / `null`.
 */
export function buildTechnicalFields(grade: string, isTechnical: boolean, specialty: string): TechnicalFieldsResult {
  if (!isTechnical || !gradeAllowsTechnical(grade)) {
    return { error: null, fields: NON_TECHNICAL };
  }
  const normalized = specialty.trim().replace(/\s+/g, " ");
  if (!normalized) return { error: "Indica la especialidad de la sección técnica.", fields: NON_TECHNICAL };
  return { error: null, fields: { is_technical: true, technical_specialty: normalized } };
}
