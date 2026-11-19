import { escapeHtml } from "./layout.ts";

export interface DebtConcept {
  name: string;
  balance: number;
}

export interface DelinquencyVariablesInput {
  studentName: string;
  gradeName: string;
  sectionName: string;
  concepts: DebtConcept[];
  total: number;
  schoolPhone: string | null;
  schoolEmail: string | null;
}

export function formatVes(amount: number): string {
  return `${amount.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} VES`;
}

/** Variables of the "delinquency" template. `conceptos_pendientes` is HTML built with escaped names. */
export function buildDelinquencyVariables(input: DelinquencyVariablesInput): Record<string, string> {
  const items = input.concepts
    .map((c) => `<li>${escapeHtml(c.name)}: <strong>${formatVes(c.balance)}</strong></li>`)
    .join("");
  return {
    nombre_estudiante: input.studentName,
    grado_seccion: input.gradeName ? [input.gradeName, input.sectionName].filter(Boolean).join(" - ") : "",
    conceptos_pendientes: `<ul>${items}</ul>`,
    total_adeudado: formatVes(input.total),
    telefono_colegio: input.schoolPhone ?? "",
    email_colegio: input.schoolEmail ?? "",
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface RepresentativeContact {
  email: string | null;
  form_data: Record<string, unknown> | null;
}

/**
 * Who receives a family's notice: the family's account email plus every representative's email
 * (the `email` column or the form's `correo_electronico`), lowercased and without duplicates.
 * The account email goes first.
 */
export function collectFamilyEmails(accountEmail: string | null, representatives: RepresentativeContact[]): string[] {
  const candidates = [
    accountEmail,
    ...representatives.flatMap((r) => [r.email, r.form_data?.correo_electronico]),
  ];
  const out: string[] = [];
  for (const c of candidates) {
    if (typeof c !== "string") continue;
    const email = c.trim().toLowerCase();
    if (EMAIL_RE.test(email) && !out.includes(email)) out.push(email);
  }
  return out;
}
