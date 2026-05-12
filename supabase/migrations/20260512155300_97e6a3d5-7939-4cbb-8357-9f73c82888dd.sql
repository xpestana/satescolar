DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_plan_concepts_plan_id_fkey'
      AND conrelid = 'public.payment_plan_concepts'::regclass
  ) THEN
    ALTER TABLE public.payment_plan_concepts
      ADD CONSTRAINT payment_plan_concepts_plan_id_fkey
      FOREIGN KEY (plan_id) REFERENCES public.payment_plans(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payment_plan_concepts_concept_id_fkey'
      AND conrelid = 'public.payment_plan_concepts'::regclass
  ) THEN
    ALTER TABLE public.payment_plan_concepts
      ADD CONSTRAINT payment_plan_concepts_concept_id_fkey
      FOREIGN KEY (concept_id) REFERENCES public.payment_concepts(id) ON DELETE CASCADE;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';