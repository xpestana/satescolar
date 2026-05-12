-- Ensure student balances exist for every assigned payment plan concept.
-- This fixes VPS cases where concepts were added to a plan after the plan had
-- already been assigned to students, leaving no student_concept_balances rows
-- for delinquency to evaluate.

CREATE OR REPLACE FUNCTION public.create_missing_student_concept_balances_for_plan_concept(_plan_concept_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.student_concept_balances (
    school_id,
    student_id,
    school_year_id,
    plan_concept_id,
    currency,
    original_amount,
    exchange_rate_snapshot,
    total_amount,
    paid_amount,
    balance,
    status
  )
  SELECT
    spp.school_id,
    spp.student_id,
    spp.school_year_id,
    ppc.id,
    COALESCE(ppc.currency, pc.currency, 'VES') AS currency,
    COALESCE(ppc.amount, 0) AS original_amount,
    COALESCE(NULLIF(er.rate_to_ves, 0), CASE WHEN COALESCE(ppc.currency, pc.currency, 'VES') = 'VES' THEN 1 ELSE 1 END) AS exchange_rate_snapshot,
    COALESCE(ppc.amount, 0) * COALESCE(NULLIF(er.rate_to_ves, 0), CASE WHEN COALESCE(ppc.currency, pc.currency, 'VES') = 'VES' THEN 1 ELSE 1 END) AS total_amount,
    0 AS paid_amount,
    COALESCE(ppc.amount, 0) * COALESCE(NULLIF(er.rate_to_ves, 0), CASE WHEN COALESCE(ppc.currency, pc.currency, 'VES') = 'VES' THEN 1 ELSE 1 END) AS balance,
    'pending' AS status
  FROM public.payment_plan_concepts ppc
  JOIN public.student_payment_plans spp ON spp.plan_id = ppc.plan_id
  LEFT JOIN public.payment_concepts pc ON pc.id = ppc.concept_id
  LEFT JOIN public.exchange_rates er
    ON er.school_id = spp.school_id
   AND er.currency = COALESCE(ppc.currency, pc.currency, 'VES')
  WHERE ppc.id = _plan_concept_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.student_concept_balances scb
      WHERE scb.student_id = spp.student_id
        AND scb.school_id = spp.school_id
        AND scb.school_year_id = spp.school_year_id
        AND scb.plan_concept_id = ppc.id
    )
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_missing_student_concept_balances_for_assignment(_student_payment_plan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignment record;
BEGIN
  SELECT * INTO v_assignment
  FROM public.student_payment_plans
  WHERE id = _student_payment_plan_id;

  IF v_assignment.id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.student_concept_balances (
    school_id,
    student_id,
    school_year_id,
    plan_concept_id,
    currency,
    original_amount,
    exchange_rate_snapshot,
    total_amount,
    paid_amount,
    balance,
    status
  )
  SELECT
    v_assignment.school_id,
    v_assignment.student_id,
    v_assignment.school_year_id,
    ppc.id,
    COALESCE(ppc.currency, pc.currency, 'VES') AS currency,
    COALESCE(ppc.amount, 0) AS original_amount,
    COALESCE(NULLIF(er.rate_to_ves, 0), CASE WHEN COALESCE(ppc.currency, pc.currency, 'VES') = 'VES' THEN 1 ELSE 1 END) AS exchange_rate_snapshot,
    COALESCE(ppc.amount, 0) * COALESCE(NULLIF(er.rate_to_ves, 0), CASE WHEN COALESCE(ppc.currency, pc.currency, 'VES') = 'VES' THEN 1 ELSE 1 END) AS total_amount,
    0 AS paid_amount,
    COALESCE(ppc.amount, 0) * COALESCE(NULLIF(er.rate_to_ves, 0), CASE WHEN COALESCE(ppc.currency, pc.currency, 'VES') = 'VES' THEN 1 ELSE 1 END) AS balance,
    'pending' AS status
  FROM public.payment_plan_concepts ppc
  LEFT JOIN public.payment_concepts pc ON pc.id = ppc.concept_id
  LEFT JOIN public.exchange_rates er
    ON er.school_id = v_assignment.school_id
   AND er.currency = COALESCE(ppc.currency, pc.currency, 'VES')
  WHERE ppc.plan_id = v_assignment.plan_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.student_concept_balances scb
      WHERE scb.student_id = v_assignment.student_id
        AND scb.school_id = v_assignment.school_id
        AND scb.school_year_id = v_assignment.school_year_id
        AND scb.plan_concept_id = ppc.id
    )
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_payment_plan_concept_balance_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.create_missing_student_concept_balances_for_plan_concept(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_student_payment_plan_balance_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.create_missing_student_concept_balances_for_assignment(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_balances_on_payment_plan_concept ON public.payment_plan_concepts;
CREATE TRIGGER trg_sync_balances_on_payment_plan_concept
AFTER INSERT OR UPDATE OF amount, currency, plan_id, concept_id
ON public.payment_plan_concepts
FOR EACH ROW
EXECUTE FUNCTION public.handle_payment_plan_concept_balance_sync();

DROP TRIGGER IF EXISTS trg_sync_balances_on_student_payment_plan ON public.student_payment_plans;
CREATE TRIGGER trg_sync_balances_on_student_payment_plan
AFTER INSERT
ON public.student_payment_plans
FOR EACH ROW
EXECUTE FUNCTION public.handle_student_payment_plan_balance_sync();

-- Backfill existing missing balances in VPS/production data.
INSERT INTO public.student_concept_balances (
  school_id,
  student_id,
  school_year_id,
  plan_concept_id,
  currency,
  original_amount,
  exchange_rate_snapshot,
  total_amount,
  paid_amount,
  balance,
  status
)
SELECT
  spp.school_id,
  spp.student_id,
  spp.school_year_id,
  ppc.id,
  COALESCE(ppc.currency, pc.currency, 'VES') AS currency,
  COALESCE(ppc.amount, 0) AS original_amount,
  COALESCE(NULLIF(er.rate_to_ves, 0), CASE WHEN COALESCE(ppc.currency, pc.currency, 'VES') = 'VES' THEN 1 ELSE 1 END) AS exchange_rate_snapshot,
  COALESCE(ppc.amount, 0) * COALESCE(NULLIF(er.rate_to_ves, 0), CASE WHEN COALESCE(ppc.currency, pc.currency, 'VES') = 'VES' THEN 1 ELSE 1 END) AS total_amount,
  0 AS paid_amount,
  COALESCE(ppc.amount, 0) * COALESCE(NULLIF(er.rate_to_ves, 0), CASE WHEN COALESCE(ppc.currency, pc.currency, 'VES') = 'VES' THEN 1 ELSE 1 END) AS balance,
  'pending' AS status
FROM public.student_payment_plans spp
JOIN public.payment_plan_concepts ppc ON ppc.plan_id = spp.plan_id
LEFT JOIN public.payment_concepts pc ON pc.id = ppc.concept_id
LEFT JOIN public.exchange_rates er
  ON er.school_id = spp.school_id
 AND er.currency = COALESCE(ppc.currency, pc.currency, 'VES')
WHERE NOT EXISTS (
  SELECT 1
  FROM public.student_concept_balances scb
  WHERE scb.student_id = spp.student_id
    AND scb.school_id = spp.school_id
    AND scb.school_year_id = spp.school_year_id
    AND scb.plan_concept_id = ppc.id
)
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';