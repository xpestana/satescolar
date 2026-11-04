// RIF and identity-document helpers. `V-12345678` is the same format the Teachers area stores,
// so a payroll beneficiary links to its teacher by document.

export type DocumentType = "V" | "E" | "P";

export const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: "V", label: "V" },
  { value: "E", label: "E" },
  { value: "P", label: "P" },
];

const RIF_PATTERN = /^([VEJGPC])-?(\d{8})-?(\d)$/;

/** Canonical RIF (`J-12345678-9`), or null if it isn't valid. */
export function normalizeTaxId(value: string | null | undefined): string | null {
  const clean = (value ?? "").trim().toUpperCase().replace(/\s+/g, "");
  const match = clean.match(RIF_PATTERN);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

export function buildDocumentId(type: string, number: string): string | null {
  const clean = number.trim().toUpperCase();
  return clean ? `${type}-${clean}` : null;
}

/** Splits a stored document into its type and number; unknown prefixes default to `V`. */
export function parseDocumentId(value: string | null | undefined): { type: DocumentType; number: string } {
  const clean = (value ?? "").trim().toUpperCase();
  const match = clean.match(/^([VEP])-?(.+)$/);
  if (match) return { type: match[1] as DocumentType, number: match[2] };
  return { type: "V", number: clean };
}

export function isValidDocumentNumber(type: string, number: string): boolean {
  const clean = number.trim();
  if (type === "P") return /^[A-Za-z0-9]{5,20}$/.test(clean);
  return /^\d{5,10}$/.test(clean);
}
