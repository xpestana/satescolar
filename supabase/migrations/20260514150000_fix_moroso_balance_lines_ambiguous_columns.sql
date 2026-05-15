-- PL/pgSQL: RETURNS TABLE(...) creates output variables named due_day, due_month, etc.
-- Unqualified "due_day" in the filtered CTE was ambiguous (column vs. output var). Qualify with overdue alias.

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
    SELECT o.*
    FROM overdue o
    WHERE
      (o.due_day IS NULL AND o.due_month IS NULL)
      OR (
        o.due_date IS NOT NULL
        AND v_today > (o.due_date + (v_grace_days || ' days')::interval)::date
      )
      OR (
        o.is_recurring AND o.due_month IS NULL AND o.due_day IS NOT NULL
        AND make_date(v_start_year, 8, o.due_day::int) < v_today
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

NOTIFY pgrst, 'reload schema';
