WITH ranked_plans AS (
  SELECT
    spp.id,
    spp.student_id,
    spp.school_id,
    spp.school_year_id,
    spp.plan_id,
    ROW_NUMBER() OVER (
      PARTITION BY spp.student_id, spp.school_id, spp.school_year_id
      ORDER BY spp.assigned_at DESC NULLS LAST, spp.created_at DESC NULLS LAST, spp.id DESC
    ) AS rn
  FROM public.student_payment_plans spp
), kept_plans AS (
  SELECT * FROM ranked_plans WHERE rn = 1
), removed_plans AS (
  SELECT * FROM ranked_plans WHERE rn > 1
), deleted_old_balances AS (
  DELETE FROM public.student_concept_balances scb
  USING removed_plans rp
  WHERE scb.student_id = rp.student_id
    AND scb.school_id = rp.school_id
    AND scb.school_year_id = rp.school_year_id
    AND EXISTS (
      SELECT 1
      FROM public.payment_plan_concepts ppc
      WHERE ppc.id = scb.plan_concept_id
        AND ppc.plan_id = rp.plan_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM kept_plans kp
      WHERE kp.student_id = rp.student_id
        AND kp.school_id = rp.school_id
        AND kp.school_year_id = rp.school_year_id
        AND kp.plan_id = rp.plan_id
    )
  RETURNING scb.id
)
DELETE FROM public.student_payment_plans spp
USING removed_plans rp
WHERE spp.id = rp.id;

DO $$
DECLARE
  v_student smallint;
  v_school smallint;
  v_year smallint;
BEGIN
  SELECT attnum INTO v_student FROM pg_attribute
  WHERE attrelid = 'public.student_payment_plans'::regclass AND attname = 'student_id' AND NOT attisdropped;

  SELECT attnum INTO v_school FROM pg_attribute
  WHERE attrelid = 'public.student_payment_plans'::regclass AND attname = 'school_id' AND NOT attisdropped;

  SELECT attnum INTO v_year FROM pg_attribute
  WHERE attrelid = 'public.student_payment_plans'::regclass AND attname = 'school_year_id' AND NOT attisdropped;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.student_payment_plans'::regclass
      AND contype IN ('u', 'p')
      AND conkey = ARRAY[v_student, v_school, v_year]
  ) THEN
    ALTER TABLE public.student_payment_plans
      ADD CONSTRAINT student_payment_plans_unique_student_school_year
      UNIQUE (student_id, school_id, school_year_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.cleanup_student_balances_on_plan_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.student_concept_balances scb
  WHERE scb.student_id = OLD.student_id
    AND scb.school_id = OLD.school_id
    AND scb.school_year_id = OLD.school_year_id
    AND EXISTS (
      SELECT 1
      FROM public.payment_plan_concepts ppc
      WHERE ppc.id = scb.plan_concept_id
        AND ppc.plan_id = OLD.plan_id
    );
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_student_balances_on_plan_removal ON public.student_payment_plans;
CREATE TRIGGER trg_cleanup_student_balances_on_plan_removal
AFTER DELETE ON public.student_payment_plans
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_student_balances_on_plan_removal();

NOTIFY pgrst, 'reload schema';