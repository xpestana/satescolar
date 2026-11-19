import { buildPrimaryRepMap, resolveFamilySurname } from "@/lib/familyDisplayName";

/**
 * Bulk-email recipients for a school's families.
 *
 * The email is the family's ACCOUNT email (the login shown in "Familias" and used for the welcome
 * email). Before, the composer only looked at `representatives.email` of the primary
 * representative, a column the app never shows and that is empty for most families, so
 * "Todas las Familias" showed (0).
 * Fallbacks: primary representative's `email` column → its `form_data.correo_electronico`.
 */

export interface FamilyRow {
  id: string;
  user_id: string | null;
  father_last_name?: string | null;
  mother_last_name?: string | null;
}

export interface RepresentativeRow {
  family_id: string;
  is_primary: boolean | null;
  email: string | null;
  form_data: Record<string, unknown> | null;
}

export interface FamilyRecipient {
  familyId: string;
  email: string;
  name: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return EMAIL_RE.test(email) ? email : null;
}

function primaryRepresentative(reps: RepresentativeRow[]): RepresentativeRow | undefined {
  return reps.find((r) => r.is_primary) ?? reps[0];
}

function representativeName(formData: Record<string, unknown> | null | undefined): string {
  const fd = (formData ?? {}) as Record<string, string | undefined>;
  return [fd.primer_nombre, fd.primer_apellido].filter(Boolean).join(" ").trim();
}

export function buildFamilyRecipients(
  families: FamilyRow[],
  representatives: RepresentativeRow[],
  accountEmails: Record<string, string>,
): FamilyRecipient[] {
  const repsByFamily = new Map<string, RepresentativeRow[]>();
  for (const rep of representatives) {
    const list = repsByFamily.get(rep.family_id) ?? [];
    list.push(rep);
    repsByFamily.set(rep.family_id, list);
  }
  const primaryFormData = buildPrimaryRepMap(representatives);

  const seen = new Set<string>();
  const recipients: FamilyRecipient[] = [];
  for (const family of families) {
    const primary = primaryRepresentative(repsByFamily.get(family.id) ?? []);
    const email =
      (family.user_id ? cleanEmail(accountEmails[family.user_id]) : null) ??
      cleanEmail(primary?.email) ??
      cleanEmail(primary?.form_data?.correo_electronico);
    if (!email || seen.has(email)) continue;
    seen.add(email);

    const surname = resolveFamilySurname(family, primaryFormData[family.id]);
    const name = representativeName(primary?.form_data) || (surname ? `Familia ${surname}` : email);
    recipients.push({ familyId: family.id, email, name });
  }
  return recipients.sort((a, b) => a.name.localeCompare(b.name, "es"));
}
