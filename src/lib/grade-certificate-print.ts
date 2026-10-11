import {
  type CertificateGradeRow,
  type GradeCertificateDocument,
  type GradeCertificateSchoolConfig,
  DEFAULT_CERTIFICATE_SUBJECTS,
  MAX_CERTIFICATE_INSTITUTIONS,
  institutionNumber,
  toCertificateText,
} from "@/lib/grade-certificate";
import { type CertificateStudentIdentity, formatCertificateDate } from "@/lib/grade-certificate-identity";
import { gradeInWords } from "@/lib/grade-in-words";
import { PLANILLA_EMPTY, orPlanillaEmpty } from "@/lib/resumen-final-text";

/**
 * Everything the Certificación de Calificaciones EMG prints, already resolved to text: empty cells
 * carry their asterisks, a year without grades carries the default áreas, grades are in words.
 * The .docx builder only lays this out.
 */

export const CERTIFICATE_TITLE = "CERTIFICACIÓN DE CALIFICACIONES EMG";
export const CERTIFICATE_PLAN_NAME = "EDUCACIÓN MEDIA GENERAL";
export const CERTIFICATE_PLAN_CODE = "31059";

/** Fillers of the official form for what was not captured, by the width of each box. */
export const CERTIFICATE_EMPTY = {
  institution: "********",
  orientation: "**********",
  groupName: "***************",
  cell: PLANILLA_EMPTY.nota,
} as const;

const YEAR_TITLES = ["PRIMER AÑO", "SEGUNDO AÑO", "TERCER AÑO", "CUARTO AÑO", "QUINTO AÑO"] as const;

export interface PrintInstitution {
  number: number;
  name: string;
  locality: string;
  federalEntity: string;
}

export interface PrintGradeRow {
  subjectName: string;
  grade: string;
  gradeInWords: string;
  evaluationType: string;
  month: string;
  year: string;
  /** N° of the institution where the área was studied. */
  institution: string;
}

export interface PrintYear {
  title: string;
  rows: PrintGradeRow[];
}

export interface CertificatePrintModel {
  title: string;
  planName: string;
  planCode: string;
  /** "MONAGAS, 10 DE OCTUBRE 2026". */
  issueLine: string;
  school: {
    code: string;
    name: string;
    address: string;
    phone: string;
    municipality: string;
    federalEntity: string;
    cdcee: string;
  };
  student: CertificateStudentIdentity;
  /** Always five rows; the ones not captured carry asterisks. */
  institutions: PrintInstitution[];
  /** Always the five years. */
  years: PrintYear[];
  orientation: Array<{ yearLabel: string; literal: string }>;
  groups: Array<{ yearLabel: string; groupName: string; literal: string }>;
  observations: string[];
  director: { name: string; documentId: string };
  cdceeDirector: { name: string; documentId: string };
  fileName: string;
}

/** The fields of Planillas → Datos comunes the certificate prints. */
export interface CertificateSchoolHeader {
  codigo_plantel?: string;
  nombre_plantel?: string;
  direccion_plantel?: string;
  telefono_plantel?: string;
  municipio_plantel?: string;
  entidad_federal?: string;
  director?: string;
  cedula_director?: string;
}

export interface CertificatePrintSource {
  document: GradeCertificateDocument;
  identity: CertificateStudentIdentity;
  schoolHeader: CertificateSchoolHeader;
  schoolConfig: GradeCertificateSchoolConfig;
  /** ISO date used when the certificate has no fecha de expedición. */
  today: string;
}

function hasGradeData(row: CertificateGradeRow): boolean {
  return [row.subjectName, row.grade, row.evaluationType, row.month, row.year].some((v) => v.trim() !== "");
}

function printGradeRow(row: CertificateGradeRow, document: GradeCertificateDocument): PrintGradeRow {
  const number = institutionNumber(document.institutions, row.institutionId);
  return {
    subjectName: toCertificateText(row.subjectName),
    grade: orPlanillaEmpty(row.grade, CERTIFICATE_EMPTY.cell),
    gradeInWords: orPlanillaEmpty(gradeInWords(row.grade), CERTIFICATE_EMPTY.cell),
    evaluationType: orPlanillaEmpty(row.evaluationType, CERTIFICATE_EMPTY.cell),
    month: orPlanillaEmpty(row.month, CERTIFICATE_EMPTY.cell),
    year: orPlanillaEmpty(row.year, CERTIFICATE_EMPTY.cell),
    institution: number ? String(number) : CERTIFICATE_EMPTY.cell,
  };
}

function emptyGradeRow(subjectName: string): PrintGradeRow {
  const empty = CERTIFICATE_EMPTY.cell;
  return { subjectName, grade: empty, gradeInWords: empty, evaluationType: empty, month: empty, year: empty, institution: empty };
}

/** "Corina de los Ángeles" → "CORINA_DE_LOS_ANGELES": safe for a file name. */
function fileNamePart(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

export function buildCertificatePrintModel(source: CertificatePrintSource): CertificatePrintModel {
  const { document, identity, schoolHeader, schoolConfig } = source;
  const federalEntity = toCertificateText(schoolHeader.entidad_federal);
  const issuePlace = toCertificateText(schoolConfig.issue_place) || federalEntity;
  const issueDate = formatCertificateDate(document.issueDate) || formatCertificateDate(source.today);

  const institutions: PrintInstitution[] = Array.from({ length: MAX_CERTIFICATE_INSTITUTIONS }, (_, index) => {
    const institution = document.institutions[index];
    return {
      number: index + 1,
      name: orPlanillaEmpty(toCertificateText(institution?.name), CERTIFICATE_EMPTY.institution),
      locality: orPlanillaEmpty(toCertificateText(institution?.locality), CERTIFICATE_EMPTY.institution),
      federalEntity: orPlanillaEmpty(toCertificateText(institution?.federalEntity), CERTIFICATE_EMPTY.institution),
    };
  });

  const years: PrintYear[] = document.yearRecords.map((year) => {
    const captured = year.grades.filter(hasGradeData);
    return {
      title: YEAR_TITLES[year.yearLevel - 1],
      rows: captured.length > 0
        ? captured.map((row) => printGradeRow(row, document))
        : DEFAULT_CERTIFICATE_SUBJECTS.map(emptyGradeRow),
    };
  });

  const fileName = ["Certificacion_de_Notas", fileNamePart(identity.lastNames), fileNamePart(identity.firstNames), fileNamePart(identity.documentId)]
    .filter(Boolean)
    .join("_");

  return {
    title: CERTIFICATE_TITLE,
    planName: CERTIFICATE_PLAN_NAME,
    planCode: CERTIFICATE_PLAN_CODE,
    issueLine: [issuePlace, issueDate].filter(Boolean).join(", "),
    school: {
      code: toCertificateText(schoolHeader.codigo_plantel),
      name: toCertificateText(schoolHeader.nombre_plantel),
      address: toCertificateText(schoolHeader.direccion_plantel),
      phone: String(schoolHeader.telefono_plantel ?? "").trim(),
      municipality: toCertificateText(schoolHeader.municipio_plantel),
      federalEntity,
      cdcee: toCertificateText(schoolConfig.cdcee) || federalEntity,
    },
    student: identity,
    institutions,
    years,
    orientation: document.yearRecords.map((year) => ({
      yearLabel: `${year.yearLevel}°`,
      literal: orPlanillaEmpty(year.orientationLiteral, CERTIFICATE_EMPTY.orientation),
    })),
    groups: document.yearRecords.map((year) => ({
      yearLabel: `${year.yearLevel}°`,
      groupName: orPlanillaEmpty(toCertificateText(year.groupName), CERTIFICATE_EMPTY.groupName),
      literal: orPlanillaEmpty(year.groupLiteral, CERTIFICATE_EMPTY.cell),
    })),
    observations: document.observations.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
    director: {
      name: toCertificateText(schoolHeader.director),
      documentId: String(schoolHeader.cedula_director ?? "").trim().toUpperCase(),
    },
    cdceeDirector: {
      name: toCertificateText(schoolConfig.cdcee_director_name),
      documentId: schoolConfig.cdcee_director_document.trim().toUpperCase(),
    },
    fileName: `${fileName}.docx`,
  };
}
