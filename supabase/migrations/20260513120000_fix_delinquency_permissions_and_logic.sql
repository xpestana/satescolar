-- Fix 1: Grant authenticated users permission to call rebuild so the frontend
-- can ensure balances exist before querying delinquency.
GRANT EXECUTE ON FUNCTION public.rebuild_student_concept_balances_for_active_year()
  TO authenticated;

-- Fix 2: Re-create get_delinquent_students as VOLATILE so it can call rebuild
-- internally. This guarantees balances are always up-to-date before the query
-- runs, regardless of whether the caller remembered to call rebuild first.
-- Also incorporates overdue_after_day grace period from delinquency_config.
DROP FUNCTION IF EXISTS public.get_delinquent_students(uuid, uuid);
CREATE OR REPLACE FUNCTION public.get_delinquent_students(
  _school_id     uuid,
  _school_year_id uuid
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
DECLARE
  v_year_range  text;
  v_start_year  int;
  v_end_year    int;
  v_today       date := (now() AT TIME ZONE 'America/Caracas')::date;
  v_grace_days  int  := 0;
BEGIN
  -- Authorization: caller must belong to the school or be admin.
  IF NOT (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.school_id = _school_id
    )
  ) THEN
    RETURN;
  END IF;

  -- Ensure all concept balances exist for every active school-year assignment
  -- before we evaluate who is delinquent.
  PERFORM public.rebuild_student_concept_balances_for_active_year();

  -- Read the school's configured grace period (days after due date).
  SELECT COALESCE(overdue_after_day, 0) INTO v_grace_days
  FROM public.delinquency_config
  WHERE school_id = _school_id;
  v_grace_days := COALESCE(v_grace_days, 0);

  -- Parse the school year range (e.g. "2025-2026") to determine which calendar
  -- year maps to each month of the academic year.
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
      -- Compute the absolute due date for this concept within the school year.
      CASE
        WHEN ppc.due_month IS NOT NULL THEN
          make_date(
            -- Months Aug–Dec belong to the start year; Jan–Jul to the end year.
            CASE WHEN ppc.due_month >= 8 THEN v_start_year ELSE v_end_year END,
            ppc.due_month::int,
            COALESCE(ppc.due_day, 28)::int
          )
        WHEN ppc.due_day IS NOT NULL AND ppc.is_recurring THEN
          -- Recurring without a fixed month: overdue if today is past the
          -- due day in the current month.
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
      -- No due date defined: treat as overdue (legacy / safety net).
      (due_day IS NULL AND due_month IS NULL)
      -- Explicit due date: overdue after due_date + grace period.
      OR (
        due_date IS NOT NULL
        AND v_today > (due_date + (v_grace_days || ' days')::interval)::date
      )
      -- Recurring without a fixed month: overdue if at least one monthly
      -- cutoff has passed since the school year started (August).
      OR (
        is_recurring AND due_month IS NULL AND due_day IS NOT NULL
        AND make_date(v_start_year, 8, due_day::int) < v_today
      )
  )
  SELECT
    f.student_id,
    SUM(f.balance)::numeric AS total_owed,
    jsonb_agg(jsonb_build_object(
      'plan_concept_id', f.plan_concept_id,
      'balance',         f.balance,
      'name',            COALESCE(f.concept_name, 'Concepto'),
      'due_day',         f.due_day,
      'due_month',       f.due_month,
      'is_recurring',    f.is_recurring
    )) AS concepts
  FROM filtered f
  GROUP BY f.student_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_delinquent_students(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_delinquent_students(uuid, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
