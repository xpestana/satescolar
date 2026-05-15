-- Shared delinquency line logic (same rules as former get_delinquent_students body).
-- Not exposed to PostgREST clients; only other SECURITY DEFINER functions call it.
CREATE OR REPLACE FUNCTION public._moroso_balance_lines(
  _school_id      uuid,
  _school_year_id uuid
)
RETURNS TABLE (
  student_id      uuid,
  plan_concept_id uuid,
  balance         numeric,
  due_day         smallint,
  due_month       smallint,
  is_recurring    boolean,
  concept_name    text
)
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year_range  text;
  v_start_year  int;
  v_end_year    int;
  v_today       date := (now() AT TIME ZONE 'America/Caracas')::date;
  v_grace_days  int  := 0;
BEGIN
  PERFORM public.rebuild_student_concept_balances_for_active_year();

  SELECT COALESCE(overdue_after_day, 0) INTO v_grace_days
  FROM public.delinquency_config
  WHERE school_id = _school_id;
  v_grace_days := COALESCE(v_grace_days, 0);

  SELECT year_range INTO v_year_range
  FROM public.school_years
  WHERE id = _school_year_id;

  IF v_year_range ~ '\d{4}.*\d{4}' THEN
    v_start_year := substring(v_year_range from '(\d{4})')::int;
    v_end_year   := substring(v_year_range from '\d{4}\D+(\d{4})')::int;
  ELSE
    v_start_year := extract(year from v_today)::int;
    v_end_year   := v_start_year;
  END IF;

  RETURN QUERY
  WITH overdue AS (
    SELECT
      scb.student_id,
      scb.balance,
      scb.plan_concept_id,
      ppc.due_day,
      ppc.due_month,
      ppc.is_recurring,
      pc.name AS concept_name,
      CASE
        WHEN ppc.due_month IS NOT NULL THEN
          make_date(
            CASE WHEN ppc.due_month >= 8 THEN v_start_year ELSE v_end_year END,
            ppc.due_month::int,
            COALESCE(ppc.due_day, 28)::int
          )
        WHEN ppc.due_day IS NOT NULL AND ppc.is_recurring THEN
          CASE
            WHEN v_today > make_date(
                   extract(year  from v_today)::int,
                   extract(month from v_today)::int,
                   ppc.due_day::int)
            THEN make_date(
                   extract(year  from v_today)::int,
                   extract(month from v_today)::int,
                   ppc.due_day::int)
            ELSE NULL
          END
        WHEN ppc.due_day IS NOT NULL THEN
          make_date(
            extract(year  from v_today)::int,
            extract(month from v_today)::int,
            ppc.due_day::int
          )
        ELSE NULL
      END AS due_date
    FROM public.student_concept_balances scb
    JOIN public.payment_plan_concepts ppc ON ppc.id = scb.plan_concept_id
    LEFT JOIN public.payment_concepts   pc  ON pc.id  = ppc.concept_id
    WHERE scb.school_id      = _school_id
      AND scb.school_year_id = _school_year_id
      AND scb.balance        > 0
  ),
  filtered AS (
    SELECT *
    FROM overdue
    WHERE
      (due_day IS NULL AND due_month IS NULL)
      OR (
        due_date IS NOT NULL
        AND v_today > (due_date + (v_grace_days || ' days')::interval)::date
      )
      OR (
        is_recurring AND due_month IS NULL AND due_day IS NOT NULL
        AND make_date(v_start_year, 8, due_day::int) < v_today
      )
  )
  SELECT
    f.student_id,
    f.plan_concept_id,
    f.balance,
    f.due_day,
    f.due_month,
    f.is_recurring,
    f.concept_name
  FROM filtered f;
END;
$$;

REVOKE ALL ON FUNCTION public._moroso_balance_lines(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._moroso_balance_lines(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public._moroso_balance_lines(uuid, uuid) FROM authenticated;

-- Reuse core lines for school delinquency list (unchanged outward behaviour).
DROP FUNCTION IF EXISTS public.get_delinquent_students(uuid, uuid);
CREATE OR REPLACE FUNCTION public.get_delinquent_students(
  _school_id       uuid,
  _school_year_id  uuid
)
RETURNS TABLE (
  student_id  uuid,
  total_owed  numeric,
  concepts    jsonb
)
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.school_id = _school_id
    )
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    m.student_id,
    SUM(m.balance)::numeric AS total_owed,
    jsonb_agg(jsonb_build_object(
      'plan_concept_id', m.plan_concept_id,
      'balance',         m.balance,
      'name',            COALESCE(m.concept_name, 'Concepto'),
      'due_day',         m.due_day,
      'due_month',       m.due_month,
      'is_recurring',    m.is_recurring
    )) AS concepts
  FROM public._moroso_balance_lines(_school_id, _school_year_id) m
  GROUP BY m.student_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_delinquent_students(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_delinquent_students(uuid, uuid) TO authenticated;

-- Family representative: same delinquency lines, only their students; shape compatible with PaymentReportModal.
CREATE OR REPLACE FUNCTION public.get_delinquent_balances_for_family(
  _family_id       uuid,
  _school_id       uuid,
  _school_year_id  uuid
)
RETURNS TABLE (
  balance_json jsonb
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
  SELECT jsonb_build_object(
    'id', scb.id,
    'student_id', scb.student_id,
    'school_id', scb.school_id,
    'school_year_id', scb.school_year_id,
    'plan_concept_id', scb.plan_concept_id,
    'currency', scb.currency,
    'original_amount', scb.original_amount,
    'exchange_rate_snapshot', scb.exchange_rate_snapshot,
    'total_amount', scb.total_amount,
    'paid_amount', scb.paid_amount,
    'balance', scb.balance,
    'status', scb.status,
    'payment_plan_concepts', jsonb_build_object(
      'amount', ppc.amount,
      'currency', ppc.currency,
      'due_day', ppc.due_day,
      'due_month', ppc.due_month,
      'is_recurring', ppc.is_recurring,
      'payment_concepts', jsonb_build_object(
        'name', COALESCE(pc.name, 'Concepto')
      )
    )
  )
  FROM public.student_concept_balances scb
  INNER JOIN public._moroso_balance_lines(_school_id, _school_year_id) mor
    ON mor.student_id = scb.student_id
   AND mor.plan_concept_id = scb.plan_concept_id
  JOIN public.payment_plan_concepts ppc ON ppc.id = scb.plan_concept_id
  LEFT JOIN public.payment_concepts pc ON pc.id = ppc.concept_id
  WHERE scb.school_id = _school_id
    AND scb.school_year_id = _school_year_id
    AND scb.student_id IN (
      SELECT s.id FROM public.students s WHERE s.family_id = _family_id
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_delinquent_balances_for_family(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_delinquent_balances_for_family(uuid, uuid, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
