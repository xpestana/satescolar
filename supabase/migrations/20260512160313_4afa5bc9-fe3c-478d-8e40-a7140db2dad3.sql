-- Multi-currency support for payment concepts
ALTER TABLE public.payment_concepts
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'VES';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payment_concepts_currency_check'
  ) THEN
    ALTER TABLE public.payment_concepts
      ADD CONSTRAINT payment_concepts_currency_check
      CHECK (currency IN ('VES','USD','EUR','COP'));
  END IF;
END $$;

ALTER TABLE public.payment_plan_concepts
  ADD COLUMN IF NOT EXISTS currency text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payment_plan_concepts_currency_check'
  ) THEN
    ALTER TABLE public.payment_plan_concepts
      ADD CONSTRAINT payment_plan_concepts_currency_check
      CHECK (currency IS NULL OR currency IN ('VES','USD','EUR','COP'));
  END IF;
END $$;

ALTER TABLE public.student_concept_balances
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'VES',
  ADD COLUMN IF NOT EXISTS original_amount numeric,
  ADD COLUMN IF NOT EXISTS exchange_rate_snapshot numeric NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'student_concept_balances_currency_check'
  ) THEN
    ALTER TABLE public.student_concept_balances
      ADD CONSTRAINT student_concept_balances_currency_check
      CHECK (currency IN ('VES','USD','EUR','COP'));
  END IF;
END $$;

-- Backfill original_amount = total_amount for existing rows
UPDATE public.student_concept_balances
SET original_amount = total_amount
WHERE original_amount IS NULL;

NOTIFY pgrst, 'reload schema';