/**
 * Recipients of a bulk email. They go in BCC (in batches) so families never see each other's
 * addresses; before this fix every recipient was listed in a single shared `To:` header.
 */

const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

export const BULK_BATCH_SIZE = 50;

export interface ParsedRecipients {
  valid: string[];
  invalid: string[];
}

/** Accepts an array or a comma/semicolon separated string; trims, lowercases and de-duplicates. */
export function parseRecipients(input: unknown): ParsedRecipients {
  const raw = Array.isArray(input)
    ? input.filter((x): x is string => typeof x === "string")
    : typeof input === "string"
      ? input.split(/[,;]/)
      : [];

  const valid: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const email = item.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    (EMAIL_RE.test(email) ? valid : invalid).push(email);
  }
  return { valid, invalid };
}

export function chunk<T>(items: T[], size: number): T[][] {
  if (size < 1) throw new Error("size must be >= 1");
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export interface BulkEnvelope {
  to: string[];
  bcc?: string[];
}

/**
 * One envelope per batch. A single recipient goes in `To:` (nothing to hide); with more, the
 * visible `To:` is the sender itself and the recipients go in BCC.
 */
export function buildBulkEnvelopes(recipients: string[], senderEmail: string, batchSize = BULK_BATCH_SIZE): BulkEnvelope[] {
  if (recipients.length === 0) return [];
  if (recipients.length === 1) return [{ to: [recipients[0]] }];
  return chunk(recipients, batchSize).map((bcc) => ({ to: [senderEmail], bcc }));
}
