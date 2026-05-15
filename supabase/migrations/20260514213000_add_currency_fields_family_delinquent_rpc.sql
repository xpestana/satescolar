-- Extend representative delinquency RPC with currency and conversion fields.
-- Keeps backward compatibility through balance_json while adding explicit columns
-- for UI rendering in concept currency and equivalent VES (rate of the day).

DROP FUNCTION IF EXISTS public.get_delinquent_balances_for_family(uuid, uuid, uuid);
CREATE OR REPLACE FUNCTION public.get_delinquent_balances_for_family(
  _family_id       uuid,
  _school_id       uuid,
  _school_year_id  uuid
)
RETURNS TABLE (
  balance_json            jsonb,
  concept_currency        text,
  balance_original_today  numeric,
  balance_ves_today       numeric,
  rate_to_ves_today       numeric,
  rate_updated_at         timestamptz
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
  SELECT
    jsonb_build_object(
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
    ) AS balance_json,
    COALESCE(ppc.currency, pc.currency, scb.currency, 'VES') AS concept_currency,
    CASE
      WHEN COALESCE(ppc.currency, pc.currency, scb.currency, 'VES') = 'VES' THEN scb.balance
      ELSE scb.balance / COALESCE(NULLIF(er.rate_to_ves, 0), 1)
    END AS balance_original_today,
    scb.balance AS balance_ves_today,
    CASE
      WHEN COALESCE(ppc.currency, pc.currency, scb.currency, 'VES') = 'VES' THEN 1
      ELSE COALESCE(NULLIF(er.rate_to_ves, 0), 1)
    END AS rate_to_ves_today,
    er.updated_at AS rate_updated_at
  FROM public.student_concept_balances scb
  INNER JOIN public._moroso_balance_lines(_school_id, _school_year_id) mor
    ON mor.student_id = scb.student_id
   AND mor.plan_concept_id = scb.plan_concept_id
  JOIN public.payment_plan_concepts ppc ON ppc.id = scb.plan_concept_id
  LEFT JOIN public.payment_concepts pc ON pc.id = ppc.concept_id
  LEFT JOIN public.exchange_rates er
    ON er.school_id = scb.school_id
   AND er.currency = COALESCE(ppc.currency, pc.currency, scb.currency, 'VES')
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
