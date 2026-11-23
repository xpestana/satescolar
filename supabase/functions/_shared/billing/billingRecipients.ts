/**
 * Who receives a school's billing emails (pure): the owner users ("usuario principal") when
 * `notifyOwner` is on, plus every active extra contact. Lower-cased, valid and without duplicates.
 */

export interface BillingContact {
  email: string | null | undefined;
  is_active?: boolean | null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value);
}

export function collectBillingRecipients(input: {
  ownerEmails: (string | null | undefined)[];
  notifyOwner: boolean;
  contacts: BillingContact[];
}): string[] {
  const candidates = [
    ...(input.notifyOwner ? input.ownerEmails : []),
    ...input.contacts.filter((c) => c.is_active !== false).map((c) => c.email),
  ];
  const recipients: string[] = [];
  for (const raw of candidates) {
    const email = String(raw ?? "").trim().toLowerCase();
    if (email && isValidEmail(email) && !recipients.includes(email)) recipients.push(email);
  }
  return recipients;
}
