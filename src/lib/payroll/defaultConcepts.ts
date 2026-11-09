// Which concepts come already filled in when registering a salary payment: those marked as
// default for the worker's category, plus the worker's own, with the worker's own amount.

import { round2 } from "./calculateNet";
import { CATEGORY_LABELS, type PayrollCategory, type PayrollConcept, type PayrollCurrency } from "./types";

/** A worker's own setting for a concept. */
export interface BeneficiaryConcept {
  concept_id: string;
  /** false = a default concept this worker doesn't get. */
  enabled: boolean;
  /** Their amount, in the concept's currency; null = the concept's default amount. */
  amount: number | null;
}

export interface DefaultConceptLine {
  concept: PayrollConcept;
  /** In the concept's currency. */
  amount: number;
}

/** Whether a concept is on by default for a category. No categories = every category. */
export function isDefaultFor(concept: PayrollConcept, category: PayrollCategory): boolean {
  if (!concept.is_default) return false;
  const categories = concept.default_categories ?? [];
  return categories.length === 0 || categories.includes(category);
}

/** The concepts to fill in for a worker, earnings first, in the concepts' own order. */
export function defaultConceptLines(
  concepts: PayrollConcept[],
  category: PayrollCategory,
  own: BeneficiaryConcept[]
): DefaultConceptLine[] {
  const ownById = new Map(own.map((o) => [o.concept_id, o]));
  const included = concepts.filter((c) => {
    if (!c.is_active) return false;
    const mine = ownById.get(c.id);
    return mine ? mine.enabled : isDefaultFor(c, category);
  });
  return [...included.filter((c) => c.concept_kind === "earning"), ...included.filter((c) => c.concept_kind === "deduction")].map(
    (concept) => ({ concept, amount: ownById.get(concept.id)?.amount ?? concept.default_amount ?? 0 })
  );
}

/** The currency to open the payment in: the one all the filled-in concepts share, if any. */
export function sharedCurrency(lines: DefaultConceptLine[]): PayrollCurrency | null {
  const currencies = new Set(lines.map((l) => l.concept.currency));
  return currencies.size === 1 ? [...currencies][0] : null;
}

/** An amount in the concept's currency, in the payment's. usdToVes = bolívares per dollar. */
export function amountInPaymentCurrency(
  amount: number,
  from: PayrollCurrency,
  to: PayrollCurrency,
  usdToVes: number
): number | null {
  if (from === to) return amount;
  if (!(usdToVes > 0)) return null;
  return round2(from === "USD" ? amount * usdToVes : amount / usdToVes);
}

/** "Todos", "Docente y Obrero"... for the concepts table. */
export function defaultCategoriesLabel(concept: PayrollConcept): string {
  if (!concept.is_default) return "No";
  const categories = concept.default_categories ?? [];
  if (categories.length === 0) return "Todos";
  return categories.map((c) => CATEGORY_LABELS[c as PayrollCategory] ?? c).join(", ");
}
