-- Apply payment_plan_concepts discounts (percentage/fixed) to the student ledger.
--
-- The discount columns (discount_type/discount_value) were added in
-- 20260610160000_add_discount_to_plan_concepts.sql, AFTER the balance-generation
-- functions were written. As a result student_concept_balances were always seeded
-- with the gross concept amount, so the discount never reached the payment
-- registration modal, the account statement or the delinquency ledger.
--
-- This migration:
--   1. Adds a helper to compute the net (post-discount) concept amount.
--   2. Rewrites the three balance-generation functions to use the net amount.
--   3. Keeps unpaid balances in sync when a concept's amount/discount is edited.
--   4. Backfills existing UNPAID balances that were seeded without the discount.
--
-- The discount is applied in the concept's own currency (original_amount); the VES
-- conversion (total_amount) is then original_amount * exchange_rate_snapshot, mirroring
-- calcFinalAmount() in PaymentConfig.tsx.

-- 1. Net amount after discount (mirrors calcFinalAmount in the frontend).
CREATE OR REPLACE FUNCTION public.discounted_plan_concept_amount(
  _amount numeric,
  _discount_type text,
  _discount_value numeric
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT GREATEST(
    0,
    CASE COALESCE(_discount_type, 'none')
      WHEN 'percentage' THEN COALESCE(_amount, 0) * (1 - COALESCE(_discount_value, 0) / 100)
      WHEN 'fixed'      THEN COALESCE(_amount, 0) - COALESCE(_discount_value, 0)
      ELSE COALESCE(_amount, 0)
    END
  );
$$;

-- 2a. Per-plan-concept balance seeding (new concept added to an assigned plan).
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
    public.discounted_plan_concept_amount(ppc.amount, ppc.discount_type, ppc.discount_value) AS original_amount,
    COALESCE(NULLIF(er.rate_to_ves, 0), 1) AS exchange_rate_snapshot,
    public.discounted_plan_concept_amount(ppc.amount, ppc.discount_type, ppc.discount_value)
      * COALESCE(NULLIF(er.rate_to_ves, 0), 1) AS total_amount,
    0 AS paid_amount,
    public.discounted_plan_concept_amount(ppc.amount, ppc.discount_type, ppc.discount_value)
      * COALESCE(NULLIF(er.rate_to_ves, 0), 1) AS balance,
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

-- 2b. Full-plan balance seeding (plan assigned to a student).
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
    public.discounted_plan_concept_amount(ppc.amount, ppc.discount_type, ppc.discount_value) AS original_amount,
    COALESCE(NULLIF(er.rate_to_ves, 0), 1) AS exchange_rate_snapshot,
    public.discounted_plan_concept_amount(ppc.amount, ppc.discount_type, ppc.discount_value)
      * COALESCE(NULLIF(er.rate_to_ves, 0), 1) AS total_amount,
    0 AS paid_amount,
    public.discounted_plan_concept_amount(ppc.amount, ppc.discount_type, ppc.discount_value)
      * COALESCE(NULLIF(er.rate_to_ves, 0), 1) AS balance,
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

-- 2c. Active-year rebuild.
CREATE OR REPLACE FUNCTION public.rebuild_student_concept_balances_for_active_year()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted integer := 0;
BEGIN
  WITH inserted AS (
    INSERT INTO public.student_concept_balances (
      school_id, student_id, school_year_id, plan_concept_id,
      currency, original_amount, exchange_rate_snapshot,
      total_amount, paid_amount, balance, status
    )
    SELECT
      spp.school_id,
      spp.student_id,
      spp.school_year_id,
      ppc.id,
      COALESCE(ppc.currency, pc.currency, 'VES'),
      public.discounted_plan_concept_amount(ppc.amount, ppc.discount_type, ppc.discount_value),
      COALESCE(NULLIF(er.rate_to_ves, 0), 1),
      public.discounted_plan_concept_amount(ppc.amount, ppc.discount_type, ppc.discount_value)
        * COALESCE(NULLIF(er.rate_to_ves, 0), 1),
      0,
      public.discounted_plan_concept_amount(ppc.amount, ppc.discount_type, ppc.discount_value)
        * COALESCE(NULLIF(er.rate_to_ves, 0), 1),
      'pending'
    FROM public.student_payment_plans spp
    JOIN public.school_years sy ON sy.id = spp.school_year_id AND sy.is_active = true
    JOIN public.payment_plan_concepts ppc ON ppc.plan_id = spp.plan_id
    LEFT JOIN public.payment_concepts pc ON pc.id = ppc.concept_id
    LEFT JOIN public.exchange_rates er
      ON er.school_id = spp.school_id
     AND er.currency = COALESCE(ppc.currency, pc.currency, 'VES')
    WHERE NOT EXISTS (
      SELECT 1 FROM public.student_concept_balances scb
      WHERE scb.student_id = spp.student_id
        AND scb.school_id = spp.school_id
        AND scb.school_year_id = spp.school_year_id
        AND scb.plan_concept_id = ppc.id
    )
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_inserted FROM inserted;

  RETURN v_inserted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rebuild_student_concept_balances_for_active_year() FROM PUBLIC, anon;

-- 3. Keep UNPAID balances in sync when a concept's amount/discount is edited.
--    (Existing balances with payments are left untouched to preserve history.)
CREATE OR REPLACE FUNCTION public.sync_unpaid_balances_for_plan_concept(_plan_concept_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.student_concept_balances scb
  SET original_amount = public.discounted_plan_concept_amount(ppc.amount, ppc.discount_type, ppc.discount_value),
      total_amount = public.discounted_plan_concept_amount(ppc.amount, ppc.discount_type, ppc.discount_value)
        * COALESCE(NULLIF(scb.exchange_rate_snapshot, 0), 1),
      balance = public.discounted_plan_concept_amount(ppc.amount, ppc.discount_type, ppc.discount_value)
        * COALESCE(NULLIF(scb.exchange_rate_snapshot, 0), 1),
      updated_at = now()
  FROM public.payment_plan_concepts ppc
  WHERE scb.plan_concept_id = ppc.id
    AND ppc.id = _plan_concept_id
    AND COALESCE(scb.paid_amount, 0) = 0;
END;
$$;

-- Seed missing balances AND resync existing unpaid ones on concept insert/update.
CREATE OR REPLACE FUNCTION public.handle_payment_plan_concept_balance_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.create_missing_student_concept_balances_for_plan_concept(NEW.id);
  PERFORM public.sync_unpaid_balances_for_plan_concept(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_balances_on_payment_plan_concept ON public.payment_plan_concepts;
CREATE TRIGGER trg_sync_balances_on_payment_plan_concept
AFTER INSERT OR UPDATE OF amount, currency, plan_id, concept_id, discount_type, discount_value
ON public.payment_plan_concepts
FOR EACH ROW
EXECUTE FUNCTION public.handle_payment_plan_concept_balance_sync();

-- 4. Backfill: recompute UNPAID balances that were seeded without the discount.
UPDATE public.student_concept_balances scb
SET original_amount = public.discounted_plan_concept_amount(ppc.amount, ppc.discount_type, ppc.discount_value),
    total_amount = public.discounted_plan_concept_amount(ppc.amount, ppc.discount_type, ppc.discount_value)
      * COALESCE(NULLIF(scb.exchange_rate_snapshot, 0), 1),
    balance = public.discounted_plan_concept_amount(ppc.amount, ppc.discount_type, ppc.discount_value)
      * COALESCE(NULLIF(scb.exchange_rate_snapshot, 0), 1),
    updated_at = now()
FROM public.payment_plan_concepts ppc
WHERE scb.plan_concept_id = ppc.id
  AND COALESCE(ppc.discount_type, 'none') <> 'none'
  AND COALESCE(ppc.discount_value, 0) > 0
  AND COALESCE(scb.paid_amount, 0) = 0
  AND ABS(
        COALESCE(scb.original_amount, 0)
        - public.discounted_plan_concept_amount(ppc.amount, ppc.discount_type, ppc.discount_value)
      ) > 0.001;

NOTIFY pgrst, 'reload schema';
