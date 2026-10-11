import { type PersonFormData, studentListName } from "@/lib/studentName";
import { normalizeSearchText, yearLevelFromGradeLevel } from "@/lib/grade-certificate";

/**
 * Students that can get a Certificación de Notas: anyone who was ever enrolled in a 1er–5to año
 * section of the school, whether still active, graduated or withdrawn.
 */

/** One enrolment in a 1er–5to año section, with the student's name fields. */
export interface CertificateEnrollmentRow {
  studentId: string;
  gradeLevel: string;
  sectionName: string;
  yearRange: string;
  documentId: string | null;
  status: string | null;
  nameFields: PersonFormData;
}

export interface CertificateStudent {
  studentId: string;
  /** "Apellidos Nombres". */
  name: string;
  documentId: string;
  status: string;
  /** Latest 1er–5to año enrolment. */
  gradeLevel: string;
  sectionName: string;
  yearRange: string;
  hasCertificate: boolean;
}

function isLaterEnrollment(candidate: CertificateEnrollmentRow, current: CertificateEnrollmentRow): boolean {
  const byYear = candidate.yearRange.localeCompare(current.yearRange);
  if (byYear !== 0) return byYear > 0;
  return (yearLevelFromGradeLevel(candidate.gradeLevel) ?? 0) > (yearLevelFromGradeLevel(current.gradeLevel) ?? 0);
}

/** One entry per student with their latest enrolment, sorted by name. */
export function buildCertificateStudentList(
  enrollments: CertificateEnrollmentRow[],
  studentIdsWithCertificate: Iterable<string>,
): CertificateStudent[] {
  const withCertificate = new Set(studentIdsWithCertificate);
  const latest = new Map<string, CertificateEnrollmentRow>();
  for (const row of enrollments) {
    if (!yearLevelFromGradeLevel(row.gradeLevel)) continue;
    const current = latest.get(row.studentId);
    if (!current || isLaterEnrollment(row, current)) latest.set(row.studentId, row);
  }

  return [...latest.values()]
    .map((row) => ({
      studentId: row.studentId,
      name: studentListName(row.nameFields),
      documentId: String(row.documentId ?? "").trim(),
      status: row.status ?? "",
      gradeLevel: row.gradeLevel,
      sectionName: row.sectionName,
      yearRange: row.yearRange,
      hasCertificate: withCertificate.has(row.studentId),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/** Students whose name or cédula has every word of the search, ignoring case and accents. */
export function filterCertificateStudents(students: CertificateStudent[], search: string): CertificateStudent[] {
  const words = normalizeSearchText(search).split(" ").filter(Boolean);
  if (words.length === 0) return students;
  return students.filter((student) => {
    const haystack = `${normalizeSearchText(student.name)} ${normalizeSearchText(student.documentId)}`;
    return words.every((word) => haystack.includes(word));
  });
}
