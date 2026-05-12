DO $$
DECLARE
  v_payment_plans_id_attnum smallint;
  v_payment_concepts_id_attnum smallint;
BEGIN
  SELECT attnum INTO v_payment_plans_id_attnum
  FROM pg_attribute
  WHERE attrelid = 'public.payment_plans'::regclass
    AND attname = 'id'
    AND NOT attisdropped;

  SELECT attnum INTO v_payment_concepts_id_attnum
  FROM pg_attribute
  WHERE attrelid = 'public.payment_concepts'::regclass
    AND attname = 'id'
    AND NOT attisdropped;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.payment_plans'::regclass
      AND contype IN ('p', 'u')
      AND conkey = ARRAY[v_payment_plans_id_attnum]
  ) THEN
    ALTER TABLE public.payment_plans
      ADD CONSTRAINT payment_plans_id_key UNIQUE (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.payment_concepts'::regclass
      AND contype IN ('p', 'u')
      AND conkey = ARRAY[v_payment_concepts_id_attnum]
  ) THEN
    ALTER TABLE public.payment_concepts
      ADD CONSTRAINT payment_concepts_id_key UNIQUE (id);
  END IF;

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
