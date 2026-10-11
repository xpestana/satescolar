import { formatResumenFinalGrade, numericToLiteralGrade } from "@/lib/gradeLiteral";
import { closingYear } from "@/lib/resumen-final-remision";
import { formatPlanillaStudentText } from "@/lib/resumen-final-text";
import {
  type CertificateGradeRow,
  type CertificateInstitution,
  type CertificateYearLevel,
  type CertificateYearRecord,
  type GradeCertificateDocument,
  DEFAULT_EVALUATION_TYPE,
  DEFAULT_GRADE_MONTH,
  addInstitution,
  createGradeRow,
  findOwnSchoolInstitution,
  getYearRecord,
  normalizeSubjectName,
  updateYearRecord,
  yearLevelFromGradeLevel,
} from "@/lib/grade-certificate";

/**
 * "Sincronizar notas" of the Certificación de Notas: what the system has for a student (definitiva
 * final of each enrolment) compared against the certificate draft, and how the subjects the school
 * picks are written into it. Nothing here reads or writes the database.
 */

/** A subject of an enrolment with its definitiva final (`final_grades`, `momento = 0`). */
export interface SyncSourceSubject {
  subjectId: string;
  name: string;
  /** `school_subjects.subject_type`: regular | orientacion | gcrp | innovacion_tecnologica_productiva. */
  subjectType: string;
  /** `school_subjects.evaluation_type`: numeric | literal. */
  evaluationType: string;
  gradeValue: string | null;
  adjustmentPoints: number;
}

/** One enrolment of the student in a 1er–5to año section. */
export interface SyncSourceEnrollment {
  enrollmentId: string;
  gradeLevel: string;
  sectionName: string;
  yearRange: string;
  subjects: SyncSourceSubject[];
}

export type SyncCandidateKind = "area" | "orientation" | "group";

/** What applying a candidate would do to the draft. */
export type SyncCandidateStatus = "new" | "update" | "unchanged" | "no_grade";

export interface SyncCandidate {
  /** Unique within the dialog: "<enrollmentId>:<subjectId | orientation | group>". */
  key: string;
  kind: SyncCandidateKind;
  /** `school_subjects.id` for áreas; null for orientation and group. */
  subjectId: string | null;
  /** Name that would be written: the área, or the group name for `group`. */
  name: string;
  /** Grade (áreas) or literal (orientation and group) the system has; "" = no definitiva yet. */
  value: string;
  /** What the draft has today for the same subject; "" when it has nothing. */
  currentName: string;
  currentValue: string;
  status: SyncCandidateStatus;
}

export interface SyncCandidateGroup {
  enrollmentId: string;
  yearLevel: CertificateYearLevel;
  gradeLevel: string;
  sectionName: string;
  yearRange: string;
  /** Year printed next to the grades: closing year of the school year ("2025-2026" → "2026"). */
  gradeYear: string;
  /** False for an older enrolment of a year the student repeated. */
  isLatestForLevel: boolean;
  candidates: SyncCandidate[];
}

const ORIENTATION_KEY = "orientation";
const GROUP_KEY = "group";

function candidateKind(subjectType: string): SyncCandidateKind | null {
  if (subjectType === "regular") return "area";
  if (subjectType === "orientacion") return ORIENTATION_KEY;
  if (subjectType === "gcrp") return GROUP_KEY;
  // innovacion_tecnologica_productiva and anything else has no place in the form.
  return null;
}

function subjectDisplayName(name: string): string {
  return formatPlanillaStudentText(name, true);
}

/** Literal A–D of a definitiva: the stored value is numeric even for literal subjects. */
function literalOf(subject: SyncSourceSubject): string {
  const raw = String(subject.gradeValue ?? "").trim();
  if (!raw) return "";
  if (/^[A-E]$/i.test(raw)) return raw.toUpperCase();
  const num = parseFloat(raw) + (subject.adjustmentPoints ?? 0);
  return isNaN(num) ? "" : numericToLiteralGrade(num);
}

/** Row of the draft that holds a subject: by its synced id first, then by name. */
function findGradeRow(
  rows: CertificateGradeRow[],
  subjectId: string,
  name: string,
  taken: ReadonlySet<string> = new Set(),
): CertificateGradeRow | undefined {
  const free = rows.filter((r) => !taken.has(r.id));
  const key = normalizeSubjectName(name);
  return free.find((r) => r.sourceSubjectId === subjectId)
    ?? free.find((r) => normalizeSubjectName(r.subjectName) === key);
}

function statusOf(value: string, hasCurrent: boolean, isSame: boolean): SyncCandidateStatus {
  if (!value) return "no_grade";
  if (!hasCurrent) return "new";
  return isSame ? "unchanged" : "update";
}

function areaCandidate(
  enrollmentId: string,
  subject: SyncSourceSubject,
  year: CertificateYearRecord,
  gradeYear: string,
): SyncCandidate {
  const name = subjectDisplayName(subject.name);
  const value = formatResumenFinalGrade(subject.gradeValue, subject.adjustmentPoints, subject.evaluationType);
  const current = findGradeRow(year.grades, subject.subjectId, name);
  const isSame = !!current
    && current.subjectName === name
    && current.grade === value
    && current.month === DEFAULT_GRADE_MONTH
    && current.year === gradeYear;
  return {
    key: `${enrollmentId}:${subject.subjectId}`,
    kind: "area",
    subjectId: subject.subjectId,
    name,
    value,
    currentName: current?.subjectName ?? "",
    currentValue: current?.grade ?? "",
    status: statusOf(value, !!current, isSame),
  };
}

function orientationCandidate(
  enrollmentId: string,
  subjects: SyncSourceSubject[],
  year: CertificateYearRecord,
): SyncCandidate | null {
  if (subjects.length === 0) return null;
  const value = subjects.map(literalOf).find(Boolean) ?? "";
  return {
    key: `${enrollmentId}:${ORIENTATION_KEY}`,
    kind: ORIENTATION_KEY,
    subjectId: null,
    name: subjectDisplayName(subjects[0].name),
    value,
    currentName: "",
    currentValue: year.orientationLiteral,
    status: statusOf(value, !!year.orientationLiteral, year.orientationLiteral === value),
  };
}

function groupCandidate(
  enrollmentId: string,
  subjects: SyncSourceSubject[],
  year: CertificateYearRecord,
): SyncCandidate | null {
  if (subjects.length === 0) return null;
  const name = [...new Set(subjects.map((s) => subjectDisplayName(s.name)).filter(Boolean))].join(", ");
  const value = subjects.map(literalOf).find(Boolean) ?? "";
  const hasCurrent = !!year.groupName || !!year.groupLiteral;
  return {
    key: `${enrollmentId}:${GROUP_KEY}`,
    kind: GROUP_KEY,
    subjectId: null,
    name,
    value,
    currentName: year.groupName,
    currentValue: year.groupLiteral,
    status: statusOf(value, hasCurrent, year.groupName === name && year.groupLiteral === value),
  };
}

/**
 * Groups what the system has by enrolment (oldest year first) and compares each subject with the
 * draft. Enrolments outside 1er–5to año and subjects without a place in the form are left out.
 */
export function buildSyncCandidates(
  enrollments: SyncSourceEnrollment[],
  draft: GradeCertificateDocument,
): SyncCandidateGroup[] {
  const groups = enrollments.flatMap((enrollment): SyncCandidateGroup[] => {
    const yearLevel = yearLevelFromGradeLevel(enrollment.gradeLevel);
    if (!yearLevel) return [];
    const year = getYearRecord(draft, yearLevel);
    const gradeYear = closingYear(enrollment.yearRange) ?? "";
    const byKind = (kind: SyncCandidateKind) =>
      enrollment.subjects.filter((s) => candidateKind(s.subjectType) === kind);

    const candidates = [
      ...byKind("area").map((s) => areaCandidate(enrollment.enrollmentId, s, year, gradeYear)),
      orientationCandidate(enrollment.enrollmentId, byKind(ORIENTATION_KEY), year),
      groupCandidate(enrollment.enrollmentId, byKind(GROUP_KEY), year),
    ].filter((c): c is SyncCandidate => c !== null);

    return [{
      enrollmentId: enrollment.enrollmentId,
      yearLevel,
      gradeLevel: enrollment.gradeLevel,
      sectionName: enrollment.sectionName,
      yearRange: enrollment.yearRange,
      gradeYear,
      isLatestForLevel: true,
      candidates,
    }];
  });

  groups.sort((a, b) => a.yearLevel - b.yearLevel || a.yearRange.localeCompare(b.yearRange));
  return groups.map((group, index) => ({
    ...group,
    isLatestForLevel: groups[index + 1]?.yearLevel !== group.yearLevel,
  }));
}

/** Preselected in the dialog: what would add or change something, from the latest enrolment of each year. */
export function defaultSyncSelection(groups: SyncCandidateGroup[]): Set<string> {
  return new Set(
    groups
      .filter((g) => g.isLatestForLevel)
      .flatMap((g) => g.candidates.filter((c) => c.status === "new" || c.status === "update").map((c) => c.key)),
  );
}

function applyGroupToYear(
  year: CertificateYearRecord,
  group: SyncCandidateGroup,
  selected: ReadonlySet<string>,
  institutionId: string | null,
): CertificateYearRecord {
  const next: CertificateYearRecord = { ...year, grades: [...year.grades] };
  const taken = new Set<string>();

  for (const candidate of group.candidates) {
    if (!selected.has(candidate.key)) continue;

    if (candidate.kind === ORIENTATION_KEY) {
      if (candidate.value) next.orientationLiteral = candidate.value;
      continue;
    }
    if (candidate.kind === GROUP_KEY) {
      next.groupName = candidate.name;
      if (candidate.value) next.groupLiteral = candidate.value;
      continue;
    }

    const synced = {
      subjectName: candidate.name,
      month: DEFAULT_GRADE_MONTH,
      year: group.gradeYear,
      institutionId,
      sourceSubjectId: candidate.subjectId,
    };
    const existing = findGradeRow(next.grades, candidate.subjectId!, candidate.name, taken);
    if (existing) {
      taken.add(existing.id);
      next.grades = next.grades.map((row) => (row.id === existing.id
        ? {
            ...row,
            ...synced,
            // A subject without definitiva keeps the grade typed by hand.
            grade: candidate.value || row.grade,
            evaluationType: row.evaluationType || DEFAULT_EVALUATION_TYPE,
          }
        : row));
    } else {
      const row = createGradeRow({ ...synced, grade: candidate.value, evaluationType: DEFAULT_EVALUATION_TYPE });
      taken.add(row.id);
      next.grades.push(row);
    }
  }
  return next;
}

/**
 * Writes the selected candidates into the draft. Name and grade of a subject that is already there
 * are overwritten; rows and years that were not selected stay as they are. The issuing school is
 * added to the institutions when missing and every synced grade is assigned to it.
 */
export function applySync(
  draft: GradeCertificateDocument,
  groups: SyncCandidateGroup[],
  selectedKeys: Iterable<string>,
  ownSchool: Omit<CertificateInstitution, "id">,
): GradeCertificateDocument {
  const selected = new Set(selectedKeys);
  const touched = groups.filter((g) => g.candidates.some((c) => selected.has(c.key)));
  if (touched.length === 0) return draft;

  let next = draft;
  const syncsAreas = touched.some((g) => g.candidates.some((c) => c.kind === "area" && selected.has(c.key)));
  if (syncsAreas && !findOwnSchoolInstitution(next.institutions)) {
    next = addInstitution(next, { ...ownSchool, isOwnSchool: true });
  }
  const institutionId = findOwnSchoolInstitution(next.institutions)?.id ?? null;

  // Groups come oldest first, so the latest enrolment of a repeated year wins.
  for (const group of touched) {
    next = updateYearRecord(next, group.yearLevel, (year) => applyGroupToYear(year, group, selected, institutionId));
  }
  return next;
}
