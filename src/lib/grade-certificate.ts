import { z } from "zod";

/**
 * Certificación de Notas (Certificación de Calificaciones EMG).
 *
 * The certificate is a snapshot the school edits by hand: it can be filled from the final grades
 * (see `grade-certificate-sync.ts`) but it does not depend on them, because a student may have
 * studied some years in another school. One document per student, stored in `grade_certificates`.
 */

/** Grade levels of Educación Media General covered by the certificate (1er–5to año). */
export const CERTIFICATE_GRADE_LEVELS = ["1_ano", "2_ano", "3_ano", "4_ano", "5_ano"] as const;

export const CERTIFICATE_YEAR_LEVELS = [1, 2, 3, 4, 5] as const;
export type CertificateYearLevel = (typeof CERTIFICATE_YEAR_LEVELS)[number];

/** The official form has room for five institutions. */
export const MAX_CERTIFICATE_INSTITUTIONS = 5;

/** T-E (tipo de evaluación) written when the school does not type one: F = final. */
export const DEFAULT_EVALUATION_TYPE = "F";

/** Month printed next to a synced grade: the school year always closes in July. */
export const DEFAULT_GRADE_MONTH = "07";

/** Áreas de formación shown for a year that has no grades yet, in the order of the form. */
export const DEFAULT_CERTIFICATE_SUBJECTS = [
  "CASTELLANO",
  "INGLES Y OTRAS LENGUAS EXTRANJERAS",
  "MATEMÁTICA",
  "EDUCACIÓN FÍSICA",
  "ARTE Y PATRIMONIO",
  "CIENCIAS NATURALES",
  "GEOGRAFÍA, HISTORIA Y CIUDADANÍA",
] as const;

/** Literals of Orientación y Convivencia and of the group (GCRP). */
export const CERTIFICATE_LITERALS = ["A", "B", "C", "D"] as const;

const institutionSchema = z.object({
  id: z.string().min(1),
  name: z.string().catch(""),
  locality: z.string().catch(""),
  federalEntity: z.string().catch(""),
  /** The school that issues the certificate; synced grades are assigned to it. */
  isOwnSchool: z.boolean().catch(false),
});

const gradeRowSchema = z.object({
  id: z.string().min(1),
  subjectName: z.string().catch(""),
  grade: z.string().catch(""),
  /** T-E column of the form. */
  evaluationType: z.string().catch(""),
  month: z.string().catch(""),
  year: z.string().catch(""),
  institutionId: z.string().nullable().catch(null),
  /** `school_subjects.id` the row was synced from; null for rows typed by hand. */
  sourceSubjectId: z.string().nullable().catch(null),
});

const yearRecordSchema = z.object({
  yearLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  grades: z.array(gradeRowSchema).catch([]),
  orientationLiteral: z.string().catch(""),
  groupName: z.string().catch(""),
  groupLiteral: z.string().catch(""),
});

export type CertificateInstitution = z.infer<typeof institutionSchema>;
export type CertificateGradeRow = z.infer<typeof gradeRowSchema>;
export type CertificateYearRecord = z.infer<typeof yearRecordSchema>;

export interface GradeCertificateDocument {
  institutions: CertificateInstitution[];
  /** Always the five years, ordered 1 → 5. */
  yearRecords: CertificateYearRecord[];
  observations: string;
  /** ISO "YYYY-MM-DD"; "" = the day the certificate is issued. */
  issueDate: string;
}

/** Columns of `grade_certificates` that hold the document. */
export interface GradeCertificateRow {
  institutions: unknown;
  year_records: unknown;
  observations: string | null;
  issue_date: string | null;
}

/**
 * Datos de la certificación, saved once per school (`planilla_general_config.grade_certificate_config`).
 * A type alias (not an interface) so it can be written to a JSON column as is.
 */
export type GradeCertificateSchoolConfig = {
  cdcee: string;
  issue_place: string;
  cdcee_director_name: string;
  cdcee_director_document: string;
};

export const EMPTY_GRADE_CERTIFICATE_SCHOOL_CONFIG: GradeCertificateSchoolConfig = {
  cdcee: "",
  issue_place: "",
  cdcee_director_name: "",
  cdcee_director_document: "",
};

export function newCertificateId(): string {
  return crypto.randomUUID();
}

function emptyYearRecord(yearLevel: CertificateYearLevel): CertificateYearRecord {
  return { yearLevel, grades: [], orientationLiteral: "", groupName: "", groupLiteral: "" };
}

export function emptyGradeCertificate(): GradeCertificateDocument {
  return {
    institutions: [],
    yearRecords: CERTIFICATE_YEAR_LEVELS.map(emptyYearRecord),
    observations: "",
    issueDate: "",
  };
}

/** Keeps the valid items of a stored array and drops the rest, so one bad item never hides the others. */
function parseItems<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const parsed = schema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

/** Stored row → document. Missing years are added and a missing row gives an empty document. */
export function parseGradeCertificate(row: GradeCertificateRow | null | undefined): GradeCertificateDocument {
  if (!row) return emptyGradeCertificate();
  const institutions = parseItems(institutionSchema, row.institutions).slice(0, MAX_CERTIFICATE_INSTITUTIONS);
  const institutionIds = new Set(institutions.map((i) => i.id));
  const storedYears = parseItems(yearRecordSchema, row.year_records);

  return {
    institutions,
    yearRecords: CERTIFICATE_YEAR_LEVELS.map((level) => {
      const stored = storedYears.find((y) => y.yearLevel === level) ?? emptyYearRecord(level);
      return {
        ...stored,
        grades: stored.grades.map((g) => ({
          ...g,
          institutionId: g.institutionId && institutionIds.has(g.institutionId) ? g.institutionId : null,
        })),
      };
    }),
    observations: row.observations ?? "",
    issueDate: row.issue_date ?? "",
  };
}

/** Document → columns to save. */
export function serializeGradeCertificate(doc: GradeCertificateDocument) {
  return {
    institutions: doc.institutions,
    year_records: doc.yearRecords,
    observations: doc.observations.trim(),
    issue_date: doc.issueDate || null,
  };
}

/** "1_ano" → 1 … "5_ano" → 5; any other grade level (6to año included) → null. */
export function yearLevelFromGradeLevel(gradeLevel: string | null | undefined): CertificateYearLevel | null {
  const index = (CERTIFICATE_GRADE_LEVELS as readonly string[]).indexOf(String(gradeLevel ?? ""));
  return index === -1 ? null : CERTIFICATE_YEAR_LEVELS[index];
}

/** Comparison key of a text: upper case, no accents, single spaces. */
export function normalizeSearchText(text: string | null | undefined): string {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Two subject names are the same subject when this key matches. */
export function normalizeSubjectName(name: string | null | undefined): string {
  return normalizeSearchText(name);
}

/** Text as the form prints it: trimmed and in upper case, keeping Ñ and accents. */
export function toCertificateText(value: string | null | undefined): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().toLocaleUpperCase("es-VE");
}

/** "9" → "09": grades and months of one digit carry a leading zero, like the Resumen Final. */
export function padTwoDigits(value: string | null | undefined): string {
  const text = String(value ?? "").trim();
  return /^\d$/.test(text) ? `0${text}` : text;
}

/** A numeric grade outside the 01–20 scale; text and empty values are not judged. */
export function isGradeOutOfRange(grade: string | null | undefined): boolean {
  const text = String(grade ?? "").trim();
  if (!/^\d+$/.test(text)) return false;
  const value = Number(text);
  return value < 1 || value > 20;
}

export function createGradeRow(overrides: Partial<CertificateGradeRow> = {}): CertificateGradeRow {
  return {
    id: newCertificateId(),
    subjectName: "",
    grade: "",
    evaluationType: "",
    month: "",
    year: "",
    institutionId: null,
    sourceSubjectId: null,
    ...overrides,
  };
}

/** The default áreas de formación with no data, for a year that has no grades yet. */
export function createDefaultGradeRows(): CertificateGradeRow[] {
  return DEFAULT_CERTIFICATE_SUBJECTS.map((subjectName) => createGradeRow({ subjectName }));
}

/** A grade row counts as filled when anything besides its subject name was typed. */
export function isGradeRowFilled(row: CertificateGradeRow): boolean {
  return [row.grade, row.evaluationType, row.month, row.year].some((v) => v.trim() !== "");
}

export function getYearRecord(doc: GradeCertificateDocument, yearLevel: CertificateYearLevel): CertificateYearRecord {
  return doc.yearRecords.find((y) => y.yearLevel === yearLevel) ?? emptyYearRecord(yearLevel);
}

export function updateYearRecord(
  doc: GradeCertificateDocument,
  yearLevel: CertificateYearLevel,
  update: (year: CertificateYearRecord) => CertificateYearRecord,
): GradeCertificateDocument {
  return {
    ...doc,
    yearRecords: doc.yearRecords.map((y) => (y.yearLevel === yearLevel ? update(y) : y)),
  };
}

export type GradeRowBulkPatch = Partial<Pick<CertificateGradeRow, "evaluationType" | "month" | "year" | "institutionId">>;

/** "Aplicar a todo el año": writes the given fields on every row of the year. */
export function applyToYearRows(rows: CertificateGradeRow[], patch: GradeRowBulkPatch): CertificateGradeRow[] {
  return rows.map((row) => ({ ...row, ...patch }));
}

export function canAddInstitution(institutions: CertificateInstitution[]): boolean {
  return institutions.length < MAX_CERTIFICATE_INSTITUTIONS;
}

export function findOwnSchoolInstitution(institutions: CertificateInstitution[]): CertificateInstitution | null {
  return institutions.find((i) => i.isOwnSchool) ?? null;
}

/** N° of the institution in the form (1-based position); null when it is not in the list. */
export function institutionNumber(institutions: CertificateInstitution[], id: string | null): number | null {
  const index = institutions.findIndex((i) => i.id === id);
  return index === -1 ? null : index + 1;
}

/** Adds an institution at the end; the list is returned unchanged once it is full. */
export function addInstitution(
  doc: GradeCertificateDocument,
  institution: Partial<Omit<CertificateInstitution, "id">> = {},
): GradeCertificateDocument {
  if (!canAddInstitution(doc.institutions)) return doc;
  return {
    ...doc,
    institutions: [
      ...doc.institutions,
      { id: newCertificateId(), name: "", locality: "", federalEntity: "", isOwnSchool: false, ...institution },
    ],
  };
}

/** Removes an institution and clears it from the grades that pointed to it. */
export function removeInstitution(doc: GradeCertificateDocument, id: string): GradeCertificateDocument {
  return {
    ...doc,
    institutions: doc.institutions.filter((i) => i.id !== id),
    yearRecords: doc.yearRecords.map((year) => ({
      ...year,
      grades: year.grades.map((g) => (g.institutionId === id ? { ...g, institutionId: null } : g)),
    })),
  };
}

/** Moves an institution one place up or down; its N° changes, the grades keep pointing to it. */
export function moveInstitution(doc: GradeCertificateDocument, id: string, direction: "up" | "down"): GradeCertificateDocument {
  const from = doc.institutions.findIndex((i) => i.id === id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from === -1 || to < 0 || to >= doc.institutions.length) return doc;
  const institutions = [...doc.institutions];
  [institutions[from], institutions[to]] = [institutions[to], institutions[from]];
  return { ...doc, institutions };
}

/** How many grades point to an institution, to warn before removing it. */
export function countGradesOfInstitution(doc: GradeCertificateDocument, id: string): number {
  return doc.yearRecords.reduce((total, year) => total + year.grades.filter((g) => g.institutionId === id).length, 0);
}

/** Acronym of a state by its name ("Monagas" → "MO"), ignoring case and accents; "" when unknown. */
export function findStateAcronym(
  states: ReadonlyArray<{ name: string; acronym: string | null }>,
  stateName: string | null | undefined,
): string {
  const key = normalizeSearchText(stateName);
  if (!key) return "";
  return states.find((s) => normalizeSearchText(s.name) === key)?.acronym?.trim().toUpperCase() ?? "";
}

export interface OwnSchoolSource {
  nombre_plantel?: string;
  municipio_plantel?: string;
  entidad_federal?: string;
}

/**
 * The issuing school as an institution of the certificate, from Planillas → Datos comunes.
 * E.F. is the state acronym when known, otherwise the first two letters of the state.
 */
export function buildOwnSchoolInstitution(
  header: OwnSchoolSource,
  stateAcronym: string | null | undefined,
): Omit<CertificateInstitution, "id"> {
  const state = String(header.entidad_federal ?? "").trim().toUpperCase();
  return {
    name: String(header.nombre_plantel ?? "").trim().toUpperCase(),
    locality: String(header.municipio_plantel ?? "").trim().toUpperCase(),
    federalEntity: String(stateAcronym ?? "").trim().toUpperCase() || state.substring(0, 2),
    isOwnSchool: true,
  };
}
