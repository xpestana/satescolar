-- New RPC: get_all_balances_for_family
-- Returns ALL pending balances (balance > 0) for a family's students, with an
-- is_overdue flag. The delinquent RPC only returned overdue ones; the rep portal
-- now needs to show everything so families can see upcoming payments too.

CREATE OR REPLACE FUNCTION public.get_all_balances_for_family(
  _family_id       uuid,
  _school_id       uuid,
  _school_year_id  uuid
)
RETURNS TABLE (
  balance_json               jsonb,
  concept_currency           text,
  remaining_original_amount  numeric,
  balance_ves_today          numeric,
  rate_to_ves_today          numeric,
  rate_updated_at            timestamptz,
  is_overdue                 boolean
)
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.families f
      WHERE f.id = _family_id AND f.user_id = auth.uid()
    )
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH overdue_set AS (
    -- _moroso_balance_lines rebuilds balances and applies grace-day logic
    SELECT mor.student_id, mor.plan_concept_id
    FROM public._moroso_balance_lines(_school_id, _school_year_id) mor
  ),
  base AS (
    SELECT
      scb.id,
      scb.student_id,
      scb.school_id,
      scb.school_year_id,
      scb.plan_concept_id,
      scb.currency,
      scb.original_amount,
      scb.exchange_rate_snapshot,
      scb.total_amount,
      scb.paid_amount,
      scb.balance,
      scb.status,
      ppc.amount     AS plan_amount,
      ppc.currency   AS plan_currency,
      ppc.due_day,
      ppc.due_month,
      ppc.is_recurring,
      pc.name        AS concept_name,
      COALESCE(ppc.currency, pc.currency, scb.currency, 'VES') AS concept_currency
    FROM public.student_concept_balances scb
    JOIN  public.payment_plan_concepts ppc ON ppc.id = scb.plan_concept_id
    LEFT  JOIN public.payment_concepts  pc  ON pc.id  = ppc.concept_id
    WHERE scb.school_id      = _school_id
      AND scb.school_year_id = _school_year_id
      AND scb.balance        > 0
      AND scb.student_id IN (
        SELECT s.id FROM public.students s WHERE s.family_id = _family_id
      )
  )
  SELECT
    jsonb_build_object(
      'id',                     b.id,
      'student_id',             b.student_id,
      'school_id',              b.school_id,
      'school_year_id',         b.school_year_id,
      'plan_concept_id',        b.plan_concept_id,
      'currency',               b.currency,
      'original_amount',        b.original_amount,
      'exchange_rate_snapshot', b.exchange_rate_snapshot,
      'total_amount',           b.total_amount,
      'paid_amount',            b.paid_amount,
      'balance',                b.balance,
      'status',                 b.status,
      'payment_plan_concepts',  jsonb_build_object(
        'amount',       b.plan_amount,
        'currency',     b.plan_currency,
        'due_day',      b.due_day,
        'due_month',    b.due_month,
        'is_recurring', b.is_recurring,
        'payment_concepts', jsonb_build_object(
          'name', COALESCE(b.concept_name, 'Concepto')
        )
      )
    ) AS balance_json,
    b.concept_currency,
    CASE
      WHEN b.concept_currency = 'VES' THEN b.balance
      ELSE b.balance / COALESCE(NULLIF(b.exchange_rate_snapshot, 0), 1)
    END AS remaining_original_amount,
    CASE
      WHEN b.concept_currency = 'VES' THEN b.balance
      ELSE (b.balance / COALESCE(NULLIF(b.exchange_rate_snapshot, 0), 1))
           * COALESCE(NULLIF(er.rate_to_ves, 0), 1)
    END AS balance_ves_today,
    CASE
      WHEN b.concept_currency = 'VES' THEN 1::numeric
      ELSE COALESCE(NULLIF(er.rate_to_ves, 0), 1)
    END AS rate_to_ves_today,
    er.updated_at            AS rate_updated_at,
    (os.student_id IS NOT NULL) AS is_overdue
  FROM base b
  LEFT JOIN overdue_set os
         ON os.student_id      = b.student_id
        AND os.plan_concept_id = b.plan_concept_id
  LEFT JOIN public.exchange_rates er
         ON er.school_id = b.school_id
        AND er.currency  = b.concept_currency;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_all_balances_for_family(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_all_balances_for_family(uuid, uuid, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
