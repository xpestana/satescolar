import { formatPlanillaStudentNameParts } from "@/lib/resumen-final-text";
import { toCertificateText } from "@/lib/grade-certificate";

/**
 * "Datos de Identificación del Estudiante" of the Certificación de Notas. They come from the
 * student's record (`students.form_data`) and are not edited in the certificate.
 */

export interface CertificateStudentIdentity {
  documentId: string;
  lastNames: string;
  firstNames: string;
  /** "18 DE JULIO 2012". */
  birthDate: string;
  birthCountry: string;
  birthState: string;
  birthMunicipality: string;
}

const MONTH_NAMES = [
  "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
] as const;

/** The form assumes Venezuela when the record has no country, like the student form does. */
const DEFAULT_BIRTH_COUNTRY = "VENEZUELA";

function longDate(day: unknown, month: unknown, year: unknown): string {
  const d = Number(day);
  const m = Number(month);
  const y = String(year ?? "").trim();
  if (!Number.isInteger(d) || d < 1 || d > 31 || !MONTH_NAMES[m - 1] || !/^\d{4}$/.test(y)) return "";
  return `${d} DE ${MONTH_NAMES[m - 1]} ${y}`;
}

/** ISO "2012-07-18" → "18 DE JULIO 2012", the way the form writes its dates; "" if it is not a date. */
export function formatCertificateDate(iso: string | null | undefined): string {
  const match = String(iso ?? "").trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? longDate(match[3], match[2], match[1]) : "";
}

export interface IdentitySource {
  document_id: string | null;
  form_data: Record<string, unknown> | null;
}

/**
 * @param resolveName turns a stored place into its name: geo fields hold either free text or the
 * id of a state / municipality.
 */
export function buildCertificateStudentIdentity(
  student: IdentitySource,
  resolveName: (value: unknown) => string,
): CertificateStudentIdentity {
  const fd = student.form_data ?? {};
  const birthDate = formatCertificateDate(fd.fecha_nacimiento as string)
    || longDate(fd.dia_nacimiento, fd.mes_nacimiento, fd.anio_nacimiento);

  return {
    documentId: String(student.document_id ?? "").trim().toUpperCase(),
    lastNames: formatPlanillaStudentNameParts([fd.primer_apellido || fd.apellido, fd.segundo_apellido], true),
    firstNames: formatPlanillaStudentNameParts([fd.primer_nombre || fd.nombre, fd.segundo_nombre], true),
    birthDate,
    birthCountry: toCertificateText(typeof fd.pais_nacimiento === "string" ? fd.pais_nacimiento : "") || DEFAULT_BIRTH_COUNTRY,
    birthState: toCertificateText(resolveName(fd.estado_nacimiento)),
    birthMunicipality: toCertificateText(resolveName(fd.municipio_nacimiento)),
  };
}

const IDENTITY_LABELS: Record<keyof CertificateStudentIdentity, string> = {
  documentId: "Cédula de identidad",
  lastNames: "Apellidos",
  firstNames: "Nombres",
  birthDate: "Fecha de nacimiento",
  birthCountry: "País de nacimiento",
  birthState: "Estado de nacimiento",
  birthMunicipality: "Municipio de nacimiento",
};

export function identityLabel(field: keyof CertificateStudentIdentity): string {
  return IDENTITY_LABELS[field];
}

/** Fields of the form the student's record does not have yet. */
export function missingIdentityFields(identity: CertificateStudentIdentity): Array<keyof CertificateStudentIdentity> {
  return (Object.keys(IDENTITY_LABELS) as Array<keyof CertificateStudentIdentity>).filter((key) => !identity[key]);
}
