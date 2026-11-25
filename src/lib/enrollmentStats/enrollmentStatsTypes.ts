import type { Database } from "@/integrations/supabase/types";
import type { SectionLabelLike } from "@/lib/gradeLevels";

export type StudentSex = Database["public"]["Enums"]["student_sex"];

/** Identity document group printed on the MPPE enrollment sheet. */
export type DocumentKind = "CI" | "CE" | "P";

/** One aggregated row of `get_enrollment_demographics`. NULLs mean "missing data". */
export interface DemographicsRow {
  section_id: string;
  age: number | null;
  sex: StudentSex | null;
  document_kind: string | null;
  total: number;
}

/** One aggregated row of `get_enrollment_answer_breakdown`. */
export interface AnswerRow {
  section_id: string;
  field_name: string;
  answer: string | null;
  sex: StudentSex | null;
  total: number;
}

export interface StatsSection extends SectionLabelLike {
  id: string;
}

/** Student form field whose answers can be counted (select with options or checkbox). */
export interface ChoiceField {
  field_name: string;
  field_label: string;
  field_type: "select" | "checkbox";
  options: string[];
}

export interface SexCount {
  male: number;
  female: number;
  /** Students whose sex is not recorded (or not recognised). */
  unknown: number;
  total: number;
}

export interface AgeCount {
  /** `null` = no valid birth date. */
  age: number | null;
  counts: SexCount;
}

export type DocumentCount = Record<DocumentKind | "unknown", number>;

/** One printable block of the sheet: a section, a grade or a grand total. */
export interface DemographicsBlock {
  key: string;
  title: string;
  /** Rows share the same age range across every block, like the original sheet. */
  ages: AgeCount[];
  bySex: SexCount;
  byDocument: DocumentCount;
}

export interface EnrollmentStatsFilter {
  /** `null` = every grade. */
  gradeLevel: string | null;
  /** `null` = every section of the grade. */
  sectionId: string | null;
}

export interface EnrollmentStats {
  /** Sections in scope after the grade/section filter, in print order. */
  sectionIds: string[];
  sectionBlocks: DemographicsBlock[];
  /** One block per grade, only when no grade is selected. */
  gradeBlocks: DemographicsBlock[];
  /** Media General / Media Técnica and level subtotals (Inicial, Primaria, Secundaria). */
  groupBlocks: DemographicsBlock[];
  total: DemographicsBlock;
  hasUnknownSex: boolean;
  hasUnknownAge: boolean;
}

export interface AnswerCount {
  /** Raw stored value (`null` = unanswered). */
  value: string | null;
  label: string;
  counts: SexCount;
}

export interface FieldBreakdown {
  fieldName: string;
  label: string;
  answers: AnswerCount[];
  total: SexCount;
}
