import type { SexCount, StudentSex } from "./enrollmentStatsTypes";

export function emptySexCount(): SexCount {
  return { male: 0, female: 0, unknown: 0, total: 0 };
}

/** Adds `amount` students of `sex` to `count` (mutates and returns it). */
export function addToSexCount(count: SexCount, sex: StudentSex | null, amount: number): SexCount {
  if (sex === "male") count.male += amount;
  else if (sex === "female") count.female += amount;
  else count.unknown += amount;
  count.total += amount;
  return count;
}
