-- Add discount support to payment_plan_concepts.
-- discount_type: 'none' | 'percentage' | 'fixed'
-- discount_value: the % value or the absolute amount in the concept's currency
ALTER TABLE public.payment_plan_concepts
  ADD COLUMN IF NOT EXISTS discount_type TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS discount_value NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE public.payment_plan_concepts
  ADD CONSTRAINT payment_plan_concepts_discount_type_check
    CHECK (discount_type IN ('none', 'percentage', 'fixed'));
