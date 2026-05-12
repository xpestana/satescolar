-- Fix overly aggressive cleanup trigger and restore balances lost by previous deduplication.

-- 1) Replace trigger so it only deletes balances when no other student_payment_plan
--    with the same (student, school, year, plan) remains. This prevents wiping
--    balances when removing a duplicate assignment of the same plan.
CREATE OR REPLACE FUNCTION public.cleanup_student_balances_on_plan_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.student_payment_plans spp
    WHERE spp.student_id = OLD.student_id
      AND spp.school_id = OLD.school_id
      AND spp.school_year_id = OLD.school_year_id
      AND spp.plan_id = OLD.plan_id
      AND spp.id <> OLD.id
  ) THEN
    -- Another assignment of the same plan still exists; keep balances intact.
    RETURN OLD;
  END IF;

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

-- 2) Restore balances for surviving student_payment_plans whose balances were
--    incorrectly wiped by the previous version of the trigger. We snapshot
--    using current exchange_rates per school. Only inserts where missing;
--    existing balances (with payments) are preserved by the unique constraint.
WITH plan_concepts AS (
  SELECT
    spp.id AS student_plan_id,
    spp.student_id,
    spp.school_id,
    spp.school_year_id,
    ppc.id AS plan_concept_id,
    COALESCE(ppc.currency, pc.currency, 'VES') AS currency,
    COALESCE(ppc.amount, 0) AS original_amount
  FROM public.student_payment_plans spp
  JOIN public.payment_plan_concepts ppc ON ppc.plan_id = spp.plan_id
  LEFT JOIN public.payment_concepts pc ON pc.id = ppc.concept_id
), with_rates AS (
  SELECT
    pc.*,
    COALESCE(
      (SELECT er.rate_to_ves FROM public.exchange_rates er
        WHERE er.school_id = pc.school_id AND er.currency = pc.currency
        LIMIT 1),
      1
    )::numeric AS rate
  FROM plan_concepts pc
)
INSERT INTO public.student_concept_balances (
  school_id, student_id, school_year_id, plan_concept_id,
  currency, original_amount, exchange_rate_snapshot,
  total_amount, paid_amount, balance, status
)
SELECT
  wr.school_id,
  wr.student_id,
  wr.school_year_id,
  wr.plan_concept_id,
  wr.currency,
  wr.original_amount,
  wr.rate,
  wr.original_amount * wr.rate,
  0,
  wr.original_amount * wr.rate,
  'pending'
FROM with_rates wr
WHERE NOT EXISTS (
  SELECT 1 FROM public.student_concept_balances scb
  WHERE scb.student_id = wr.student_id
    AND scb.school_year_id = wr.school_year_id
    AND scb.plan_concept_id = wr.plan_concept_id
);

NOTIFY pgrst, 'reload schema';