
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY student_id, school_year_id, plan_concept_id
           ORDER BY paid_amount DESC NULLS LAST, updated_at ASC, id ASC
         ) AS rn
  FROM public.student_concept_balances
)
DELETE FROM public.student_concept_balances scb
USING ranked r
WHERE scb.id = r.id AND r.rn > 1;

DELETE FROM public.student_concept_balances scb
WHERE NOT EXISTS (
  SELECT 1 FROM public.student_payment_plans spp
  WHERE spp.student_id = scb.student_id
    AND spp.school_year_id = scb.school_year_id
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'student_concept_balances_unique_student_year_concept'
  ) THEN
    ALTER TABLE public.student_concept_balances
      ADD CONSTRAINT student_concept_balances_unique_student_year_concept
      UNIQUE (student_id, school_year_id, plan_concept_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.cleanup_student_balances_on_plan_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.student_concept_balances
  WHERE student_id = OLD.student_id
    AND school_year_id = OLD.school_year_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_student_balances_on_plan_removal ON public.student_payment_plans;
CREATE TRIGGER trg_cleanup_student_balances_on_plan_removal
AFTER DELETE ON public.student_payment_plans
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_student_balances_on_plan_removal();

NOTIFY pgrst, 'reload schema';
