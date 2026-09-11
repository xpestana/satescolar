/**
 * Net amount of a plan concept after its plan discount, in the concept's currency.
 * Same formula as the SQL helper `discounted_plan_concept_amount`, floored at 0.
 */
export function calcFinalAmount(amount: number, discountType: string, discountValue: number): number {
  if (discountType === "percentage") return Math.max(0, amount * (1 - discountValue / 100));
  if (discountType === "fixed") return Math.max(0, amount - discountValue);
  return amount;
}
