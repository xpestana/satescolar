/**
 * Grade level catalogue shared by every screen that has to decide which report card / grading
 * rules apply to a student.
 *
 * These sets used to be copy-pasted in `GradesConsultation.tsx` and `FinalGradesTab.tsx`; the
 * representative module would have been a third copy, so they live here now.
 */

export type GradeLevelKind = "preschool" | "primary" | "secondary" | "unknown";

export const GRADE_LABELS: Record<string, string> = {
  pre_maternal: "Pre-Maternal", maternal: "Maternal", inicial: "Inicial",
  i_nivel: "I Nivel", ii_nivel: "II Nivel", iii_nivel: "III Nivel",
  primaria: "Primaria",
  "1_grado": "1er Grado", "2_grado": "2do Grado", "3_grado": "3er Grado",
  "4_grado": "4to Grado", "5_grado": "5to Grado", "6_grado": "6to Grado",
  media_general: "Media General",
  "1_ano": "1er Año", "2_ano": "2do Año", "3_ano": "3er Año",
  "4_ano": "4to Año", "5_ano": "5to Año",
  media_tecnica: "Media Técnica", "6_ano": "6to Año",
};

export const PRESCHOOL_GRADES = new Set([
  "pre_maternal", "maternal", "i_nivel", "ii_nivel", "iii_nivel",
]);

export const PRIMARY_GRADES = new Set([
  "1_grado", "2_grado", "3_grado", "4_grado", "5_grado", "6_grado",
]);

export const SECONDARY_GRADES = new Set([
  "media_general", "1_ano", "2_ano", "3_ano", "4_ano", "5_ano",
  "media_tecnica", "6_ano",
]);

/** Grades whose evaluation is numeric (20 point scale). Today it matches secondary exactly. */
export const NUMERIC_GRADES = SECONDARY_GRADES;

export function resolveGradeLevelKind(gradeLevel: string | null | undefined): GradeLevelKind {
  if (!gradeLevel) return "unknown";
  if (PRESCHOOL_GRADES.has(gradeLevel)) return "preschool";
  if (PRIMARY_GRADES.has(gradeLevel)) return "primary";
  if (SECONDARY_GRADES.has(gradeLevel)) return "secondary";
  return "unknown";
}

export function gradeLabel(gradeLevel: string | null | undefined): string {
  if (!gradeLevel) return "";
  return GRADE_LABELS[gradeLevel] || gradeLevel;
}

/** Minimum shape needed to print a section. `is_technical` is optional for queries that predate it. */
export interface SectionNameLike {
  name: string | null;
  is_technical?: boolean | null;
}

export interface SectionLabelLike extends SectionNameLike {
  grade_level: string;
}

export const TECHNICAL_SECTION_SUFFIX = "(Técnica)";

/** "A" or "A (Técnica)"; empty without a section. Use it wherever the section name is shown. */
export function sectionDisplayName(section: SectionNameLike | null | undefined): string {
  if (!section?.name) return "";
  return section.is_technical ? `${section.name} ${TECHNICAL_SECTION_SUFFIX}` : section.name;
}

/** "4to Grado - Sección U" / "1er Año - Sección A (Técnica)"; empty without a section. */
export function formatSectionLabel(section: SectionLabelLike | null | undefined): string {
  return section ? `${gradeLabel(section.grade_level)} - Sección ${sectionDisplayName(section)}` : "";
}

/** "4to Grado - U" / "1er Año - A (Técnica)"; empty without a section. */
export function formatGradeSectionLabel(section: SectionLabelLike | null | undefined): string {
  return section ? `${gradeLabel(section.grade_level)} - ${sectionDisplayName(section)}` : "";
}
