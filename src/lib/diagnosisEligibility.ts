import { resolveGradeLevelKind } from "@/lib/gradeLevels";

/**
 * The diagnosis sheet exists only in preschool and primary, and each section has ONE área that
 * carries it, written by its teacher (the docente guía): the área marked `is_main_report` — the one
 * that signs the primaria boleta — or, when none is marked, the first área by the school's subject
 * order and then by name. Secondary and GCRP (no section) have no diagnosis.
 */

export function isDiagnosisGrade(gradeLevel: string | null | undefined): boolean {
  const kind = resolveGradeLevelKind(gradeLevel);
  return kind === "preschool" || kind === "primary";
}

export interface DiagnosisCandidate {
  assignmentId: string;
  sectionId: string;
  schoolYearId: string;
  isMainReport: boolean;
  subjectName: string;
  displayOrder: number | null;
}

export const diagnosisSectionKey = (sectionId: string, schoolYearId: string) => `${sectionId}:${schoolYearId}`;

function compareCandidates(a: DiagnosisCandidate, b: DiagnosisCandidate): number {
  if (a.isMainReport !== b.isMainReport) return a.isMainReport ? -1 : 1;
  const ao = a.displayOrder ?? Number.MAX_SAFE_INTEGER;
  const bo = b.displayOrder ?? Number.MAX_SAFE_INTEGER;
  if (ao !== bo) return ao - bo;
  return a.subjectName.localeCompare(b.subjectName);
}

/** The área carrying the diagnosis of each section × school year (key: `diagnosisSectionKey`). */
export function pickDiagnosisAssignments<T extends DiagnosisCandidate>(candidates: T[]): Map<string, T> {
  const picked = new Map<string, T>();
  for (const c of candidates) {
    const key = diagnosisSectionKey(c.sectionId, c.schoolYearId);
    const current = picked.get(key);
    if (!current || compareCandidates(c, current) < 0) picked.set(key, c);
  }
  return picked;
}
