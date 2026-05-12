-- 1. Idempotent rebuild of missing balances for the active school year(s)
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
      COALESCE(ppc.amount, 0),
      COALESCE(NULLIF(er.rate_to_ves, 0), 1),
      COALESCE(ppc.amount, 0) * COALESCE(NULLIF(er.rate_to_ves, 0), 1),
      0,
      COALESCE(ppc.amount, 0) * COALESCE(NULLIF(er.rate_to_ves, 0), 1),
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

-- 2. Delinquency query: returns aggregated delinquent students for a school+year
DROP FUNCTION IF EXISTS public.get_delinquent_students(uuid, uuid);
CREATE OR REPLACE FUNCTION public.get_delinquent_students(_school_id uuid, _school_year_id uuid)
RETURNS TABLE (
  student_id uuid,
  total_owed numeric,
  concepts jsonb
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year_range text;
  v_start_year int;
  v_end_year int;
  v_today date := (now() AT TIME ZONE 'America/Caracas')::date;
BEGIN
  -- Authorization: caller must belong to the school or be admin
  IF NOT (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.school_id = _school_id)
  ) THEN
    RETURN;
  END IF;

  SELECT year_range INTO v_year_range FROM public.school_years WHERE id = _school_year_id;

  IF v_year_range ~ '\d{4}.*\d{4}' THEN
    v_start_year := substring(v_year_range from '(\d{4})')::int;
    v_end_year := substring(v_year_range from '\d{4}\D+(\d{4})')::int;
  ELSE
    v_start_year := extract(year from v_today)::int;
    v_end_year := v_start_year;
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
          -- Recurrent: overdue if any month from August(start_year) until today has passed its due_day
          CASE WHEN v_today > make_date(extract(year from v_today)::int, extract(month from v_today)::int, ppc.due_day::int)
               THEN make_date(extract(year from v_today)::int, extract(month from v_today)::int, ppc.due_day::int)
               ELSE NULL END
        WHEN ppc.due_day IS NOT NULL THEN
          make_date(extract(year from v_today)::int, extract(month from v_today)::int, ppc.due_day::int)
        ELSE NULL
      END AS due_date
    FROM public.student_concept_balances scb
    JOIN public.payment_plan_concepts ppc ON ppc.id = scb.plan_concept_id
    LEFT JOIN public.payment_concepts pc ON pc.id = ppc.concept_id
    WHERE scb.school_id = _school_id
      AND scb.school_year_id = _school_year_id
      AND scb.balance > 0
  ),
  filtered AS (
    SELECT *
    FROM overdue
    WHERE
      -- Legacy: no due defined => still considered overdue (do not hide debts)
      (due_day IS NULL AND due_month IS NULL)
      OR (due_date IS NOT NULL AND v_today > due_date)
      -- Recurrent without month: overdue if at least one cutoff already passed in school year
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
      'balance', f.balance,
      'name', COALESCE(f.concept_name, 'Concepto'),
      'due_day', f.due_day,
      'due_month', f.due_month,
      'is_recurring', f.is_recurring
    )) AS concepts
  FROM filtered f
  GROUP BY f.student_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_delinquent_students(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_delinquent_students(uuid, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';