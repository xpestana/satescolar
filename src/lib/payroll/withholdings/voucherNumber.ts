export const VOUCHER_MAX_SEQUENCE = 99_999_999;

/**
 * Voucher number `AAAAMMSSSSSSSS` (art. 18, Providencia SNAT/2026/00093). The database assigns
 * the real one; this version is for previews and for checking the format.
 */
export function formatVoucherNumber(date: string, sequence: number): string {
  const [year, month] = date.slice(0, 10).split("-");
  return `${year}${month}${String(sequence).padStart(8, "0")}`;
}

export function isValidVoucherNumber(value: string): boolean {
  return /^\d{4}(0[1-9]|1[0-2])\d{8}$/.test(value);
}
