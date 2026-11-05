-- Each period decides whether its salary payments discount withholdings and contributions.
-- A school that pays twice a month can pay the 1st half in full and discount everything in the
-- 2nd half, calculated over the whole month. Adds automatic employee contributions (IVSS,
-- paro forzoso / RPE, FAOV) with versioned percentages, like the ISLR rates.
-- Additive: existing periods keep discounting, and contributions start OFF in every school.

-- ── 1. Periods and concepts ──────────────────────────────────────────────────

ALTER TABLE public.payroll_periods
  ADD COLUMN IF NOT EXISTS apply_deductions boolean NOT NULL DEFAULT true;

ALTER TABLE public.payroll_concepts
  ADD COLUMN IF NOT EXISTS is_contribution_base boolean NOT NULL DEFAULT true;

-- Payments of the same worker earlier in the month that a discounting payment summed up.
-- Checked again when paying, so a payment registered or voided later forces a recalculation.
ALTER TABLE public.payroll_payments
  ADD COLUMN IF NOT EXISTS month_base_payment_ids uuid[];

-- ── 2. New tables ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payroll_contribution_settings (
  school_id uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  rates_validated_at timestamptz,
  rates_validated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One row holds every value in force from a date. Never updated: a change adds a new row.
-- cap_wages = how many minimum wages the monthly base can reach (0 = no cap).
-- method: 'mondays' = weekly salary (month × 12 ÷ 52) × Mondays of the month; 'monthly' = over the month.
CREATE TABLE IF NOT EXISTS public.payroll_contribution_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  valid_from date NOT NULL,
  minimum_wage_ves numeric NOT NULL CHECK (minimum_wage_ves > 0),
  ivss_pct numeric NOT NULL DEFAULT 4 CHECK (ivss_pct BETWEEN 0 AND 100),
  ivss_cap_wages numeric NOT NULL DEFAULT 5 CHECK (ivss_cap_wages >= 0),
  ivss_method text NOT NULL DEFAULT 'mondays' CHECK (ivss_method IN ('mondays','monthly')),
  rpe_pct numeric NOT NULL DEFAULT 0.5 CHECK (rpe_pct BETWEEN 0 AND 100),
  rpe_cap_wages numeric NOT NULL DEFAULT 10 CHECK (rpe_cap_wages >= 0),
  rpe_method text NOT NULL DEFAULT 'mondays' CHECK (rpe_method IN ('mondays','monthly')),
  faov_pct numeric NOT NULL DEFAULT 1 CHECK (faov_pct BETWEEN 0 AND 100),
  faov_cap_wages numeric NOT NULL DEFAULT 0 CHECK (faov_cap_wages >= 0),
  faov_method text NOT NULL DEFAULT 'monthly' CHECK (faov_method IN ('mondays','monthly')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payroll_contribution_parameters_school_date_uq UNIQUE (school_id, valid_from)
);

-- What each payment discounted for each contribution, and how it was calculated.
CREATE TABLE IF NOT EXISTS public.payroll_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  payment_id uuid NOT NULL REFERENCES public.payroll_payments(id) ON DELETE CASCADE,
  beneficiary_id uuid NOT NULL REFERENCES public.payroll_beneficiaries(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('ivss','rpe','faov')),
  method text NOT NULL CHECK (method IN ('mondays','monthly')),
  month_start date NOT NULL,
  month_base_ves numeric NOT NULL DEFAULT 0 CHECK (month_base_ves >= 0),
  capped_base_ves numeric NOT NULL DEFAULT 0 CHECK (capped_base_ves >= 0),
  cap_wages numeric NOT NULL DEFAULT 0,
  minimum_wage_ves numeric NOT NULL DEFAULT 0,
  rate_pct numeric NOT NULL DEFAULT 0,
  mondays integer,
  month_total_ves numeric NOT NULL DEFAULT 0 CHECK (month_total_ves >= 0),
  previously_deducted_ves numeric NOT NULL DEFAULT 0 CHECK (previously_deducted_ves >= 0),
  amount_ves numeric NOT NULL DEFAULT 0 CHECK (amount_ves >= 0),
  amount numeric NOT NULL DEFAULT 0 CHECK (amount >= 0),
  parameters_version_id uuid REFERENCES public.payroll_contribution_parameters(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payroll_payment_items
  ADD COLUMN IF NOT EXISTS contribution_id uuid;
ALTER TABLE public.payroll_payment_items
  DROP CONSTRAINT IF EXISTS payroll_payment_items_contribution_fk;
ALTER TABLE public.payroll_payment_items
  ADD CONSTRAINT payroll_payment_items_contribution_fk
  FOREIGN KEY (contribution_id) REFERENCES public.payroll_contributions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payroll_contribution_parameters_school ON public.payroll_contribution_parameters(school_id);
CREATE INDEX IF NOT EXISTS idx_payroll_contributions_payment ON public.payroll_contributions(payment_id);
CREATE INDEX IF NOT EXISTS idx_payroll_contributions_school_month ON public.payroll_contributions(school_id, month_start);
CREATE INDEX IF NOT EXISTS idx_payroll_contributions_beneficiary ON public.payroll_contributions(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_payroll_items_contribution ON public.payroll_payment_items(contribution_id);

-- ── 3. Row Level Security ────────────────────────────────────────────────────

ALTER TABLE public.payroll_contribution_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_contribution_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_contributions ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY['payroll_contribution_settings','payroll_contribution_parameters','payroll_contributions'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Admins manage all %1$s" ON public.%1$s;', t);
    EXECUTE format(
      'CREATE POLICY "Admins manage all %1$s" ON public.%1$s FOR ALL '
      'USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));', t);
    EXECUTE format('DROP POLICY IF EXISTS "School staff read %1$s" ON public.%1$s;', t);
    EXECUTE format(
      'CREATE POLICY "School staff read %1$s" ON public.%1$s FOR SELECT '
      'USING ((select public.is_school_staff(%1$s.school_id)));', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Config manages payroll_contribution_settings" ON public.payroll_contribution_settings;
CREATE POLICY "Config manages payroll_contribution_settings" ON public.payroll_contribution_settings FOR ALL
  USING (public.payroll_can(school_id, 'payroll.config'))
  WITH CHECK (public.payroll_can(school_id, 'payroll.config'));

DROP POLICY IF EXISTS "Config adds payroll_contribution_parameters" ON public.payroll_contribution_parameters;
CREATE POLICY "Config adds payroll_contribution_parameters" ON public.payroll_contribution_parameters FOR INSERT
  WITH CHECK (public.payroll_can(school_id, 'payroll.config'));
DROP POLICY IF EXISTS "Config deletes future payroll_contribution_parameters" ON public.payroll_contribution_parameters;
CREATE POLICY "Config deletes future payroll_contribution_parameters" ON public.payroll_contribution_parameters FOR DELETE
  USING (valid_from > current_date AND public.payroll_can(school_id, 'payroll.config'));

-- Written by the payment RPCs below, which run as the caller.
DROP POLICY IF EXISTS "Payroll writes payroll_contributions" ON public.payroll_contributions;
CREATE POLICY "Payroll writes payroll_contributions" ON public.payroll_contributions FOR ALL
  USING (public.payroll_can(school_id, 'payroll.register') OR public.payroll_can(school_id, 'payroll.approve'))
  WITH CHECK (public.payroll_can(school_id, 'payroll.register') OR public.payroll_can(school_id, 'payroll.approve'));

-- ── 4. Guards ────────────────────────────────────────────────────────────────

-- Whether a period discounts, and the month it falls in, can't change once it has live payments:
-- it would change how those payments were calculated.
CREATE OR REPLACE FUNCTION public.guard_payroll_period_deductions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF (NEW.apply_deductions IS DISTINCT FROM OLD.apply_deductions
      OR date_trunc('month', NEW.end_date) IS DISTINCT FROM date_trunc('month', OLD.end_date))
     AND EXISTS (SELECT 1 FROM public.payroll_payments p WHERE p.period_id = OLD.id AND p.status <> 'voided') THEN
    RAISE EXCEPTION 'PERIOD_LOCKED: el período ya tiene pagos; anúlelos antes de cambiar si descuenta o su mes';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_payroll_period_deductions ON public.payroll_periods;
CREATE TRIGGER trg_guard_payroll_period_deductions
  BEFORE UPDATE ON public.payroll_periods
  FOR EACH ROW EXECUTE FUNCTION public.guard_payroll_period_deductions();

-- Live salary payments of the same worker in the same month, in periods that end earlier.
-- Sorted, so two lists can be compared directly.
CREATE OR REPLACE FUNCTION public.payroll_month_prior_payment_ids(_payment_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT coalesce(array_agg(p.id ORDER BY p.id), '{}'::uuid[])
  FROM public.payroll_payments me
  JOIN public.payroll_periods mp ON mp.id = me.period_id
  JOIN public.payroll_payments p
    ON p.beneficiary_id = me.beneficiary_id AND p.id <> me.id
   AND p.payment_kind = 'payroll' AND p.status <> 'voided'
  JOIN public.payroll_periods pp ON pp.id = p.period_id
  WHERE me.id = _payment_id
    AND date_trunc('month', pp.end_date) = date_trunc('month', mp.end_date)
    AND pp.end_date < mp.end_date
$$;
REVOKE EXECUTE ON FUNCTION public.payroll_month_prior_payment_ids(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.payroll_month_prior_payment_ids(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.payroll_sorted_ids(_ids uuid[])
RETURNS uuid[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(array_agg(x ORDER BY x), '{}'::uuid[]) FROM unnest(coalesce(_ids, '{}'::uuid[])) AS x
$$;

-- ── 5. Payment RPCs ──────────────────────────────────────────────────────────

-- The old version had no contributions; dropped so nothing can skip the new checks.
DROP FUNCTION IF EXISTS public.write_payroll_payment_lines(public.payroll_payments, jsonb, jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.write_payroll_payment_lines(
  _payment public.payroll_payments,
  _items jsonb,
  _withholdings jsonb,
  _contributions jsonb,
  _documents_by_key jsonb
)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_settings public.payroll_tax_settings;
  v_contribution_settings public.payroll_contribution_settings;
  v_period public.payroll_periods;
  v_school public.schools;
  v_beneficiary public.payroll_beneficiaries;
  v_wh jsonb;
  v_ct jsonb;
  v_item jsonb;
  v_ids jsonb := '{}'::jsonb;
  v_ct_ids jsonb := '{}'::jsonb;
  v_new_id uuid;
  v_key text;
  v_ct_key text;
  v_gross numeric := 0;
  v_deductions numeric := 0;
  v_net numeric;
  v_amount numeric;
  v_wh_total numeric := 0;
  v_item_wh_total numeric := 0;
  v_ct_total numeric := 0;
  v_item_ct_total numeric := 0;
BEGIN
  SELECT * INTO v_settings FROM public.payroll_tax_settings WHERE school_id = _payment.school_id;
  SELECT * INTO v_contribution_settings FROM public.payroll_contribution_settings WHERE school_id = _payment.school_id;
  SELECT * INTO v_period FROM public.payroll_periods WHERE id = _payment.period_id;
  SELECT * INTO v_school FROM public.schools WHERE id = _payment.school_id;
  SELECT * INTO v_beneficiary FROM public.payroll_beneficiaries WHERE id = _payment.beneficiary_id;

  -- The period decides for salaries. Supplier withholdings are always due when paying.
  IF _payment.payment_kind = 'payroll' THEN
    IF NOT coalesce(v_period.apply_deductions, true) THEN
      IF jsonb_array_length(coalesce(_withholdings, '[]'::jsonb)) > 0
         OR jsonb_array_length(coalesce(_contributions, '[]'::jsonb)) > 0 THEN
        RAISE EXCEPTION 'INVALID_PAYMENT: este período no descuenta retenciones ni parafiscales';
      END IF;
    -- NULL = an app version that doesn't sum the month yet; it calculates each payment alone.
    ELSIF _payment.month_base_payment_ids IS NOT NULL
          AND public.payroll_sorted_ids(_payment.month_base_payment_ids)
          IS DISTINCT FROM public.payroll_month_prior_payment_ids(_payment.id) THEN
      RAISE EXCEPTION 'MONTH_BASE_CHANGED: cambiaron los pagos de este mes del trabajador; cierre y vuelva a abrir el pago';
    END IF;
  ELSIF jsonb_array_length(coalesce(_contributions, '[]'::jsonb)) > 0 THEN
    RAISE EXCEPTION 'INVALID_PAYMENT: los parafiscales solo aplican a sueldos';
  END IF;

  FOR v_wh IN SELECT * FROM jsonb_array_elements(coalesce(_withholdings, '[]'::jsonb)) LOOP
    IF v_wh->>'tax_type' = 'vat' AND NOT coalesce(v_settings.vat_agent_enabled, false) THEN
      RAISE EXCEPTION 'WITHHOLDING_DISABLED: la retención de IVA no está activa en este colegio';
    END IF;
    IF v_wh->>'tax_type' = 'islr' AND NOT coalesce(v_settings.islr_agent_enabled, false) THEN
      RAISE EXCEPTION 'WITHHOLDING_DISABLED: la retención de ISLR no está activa en este colegio';
    END IF;

    INSERT INTO public.payroll_withholdings (
      school_id, payment_id, document_id, beneficiary_id, tax_type, source,
      base_ves, base_pct, rate_pct, tax_amount_ves, subtrahend_ves, minimum_ves, tax_unit_value,
      exchange_rate, withheld_ves, withheld_amount, no_withholding_reason,
      islr_concept_id, islr_concept_name, islr_seniat_code, person_type,
      parameters_version_id, islr_rate_version_id, ari_rate_id, is_override, override_reason,
      beneficiary_snapshot, agent_snapshot, created_by
    ) VALUES (
      _payment.school_id, _payment.id,
      CASE WHEN v_wh->>'document_key' IS NULL THEN NULL
           ELSE (_documents_by_key->>(v_wh->>'document_key'))::uuid END,
      _payment.beneficiary_id, v_wh->>'tax_type', v_wh->>'source',
      coalesce((v_wh->>'base_ves')::numeric, 0), coalesce((v_wh->>'base_pct')::numeric, 100),
      coalesce((v_wh->>'rate_pct')::numeric, 0), coalesce((v_wh->>'tax_amount_ves')::numeric, 0),
      coalesce((v_wh->>'subtrahend_ves')::numeric, 0), coalesce((v_wh->>'minimum_ves')::numeric, 0),
      (v_wh->>'tax_unit_value')::numeric, _payment.exchange_rate,
      coalesce((v_wh->>'withheld_ves')::numeric, 0), coalesce((v_wh->>'withheld_amount')::numeric, 0),
      v_wh->>'no_withholding_reason',
      (v_wh->>'islr_concept_id')::uuid, v_wh->>'islr_concept_name', v_wh->>'islr_seniat_code',
      v_wh->>'person_type', (v_wh->>'parameters_version_id')::uuid,
      (v_wh->>'islr_rate_version_id')::uuid, (v_wh->>'ari_rate_id')::uuid,
      coalesce((v_wh->>'is_override')::boolean, false), v_wh->>'override_reason',
      jsonb_build_object(
        'name', v_beneficiary.full_name, 'tax_id', v_beneficiary.tax_id,
        'document_id', v_beneficiary.document_id, 'fiscal_address', v_beneficiary.fiscal_address,
        'email', v_beneficiary.email),
      jsonb_build_object('name', v_school.name, 'tax_id', v_school.rif, 'fiscal_address', v_school.address),
      v_uid
    ) RETURNING id INTO v_new_id;

    v_wh_total := v_wh_total + coalesce((v_wh->>'withheld_amount')::numeric, 0);
    v_ids := v_ids || jsonb_build_object(v_wh->>'key', v_new_id);
  END LOOP;

  FOR v_ct IN SELECT * FROM jsonb_array_elements(coalesce(_contributions, '[]'::jsonb)) LOOP
    IF NOT coalesce(v_contribution_settings.enabled, false) THEN
      RAISE EXCEPTION 'WITHHOLDING_DISABLED: los parafiscales no están activos en este colegio';
    END IF;

    INSERT INTO public.payroll_contributions (
      school_id, payment_id, beneficiary_id, kind, method, month_start, month_base_ves, capped_base_ves,
      cap_wages, minimum_wage_ves, rate_pct, mondays, month_total_ves, previously_deducted_ves,
      amount_ves, amount, parameters_version_id, created_by
    ) VALUES (
      _payment.school_id, _payment.id, _payment.beneficiary_id, v_ct->>'kind', v_ct->>'method',
      date_trunc('month', v_period.end_date)::date,
      coalesce((v_ct->>'month_base_ves')::numeric, 0), coalesce((v_ct->>'capped_base_ves')::numeric, 0),
      coalesce((v_ct->>'cap_wages')::numeric, 0), coalesce((v_ct->>'minimum_wage_ves')::numeric, 0),
      coalesce((v_ct->>'rate_pct')::numeric, 0), (v_ct->>'mondays')::integer,
      coalesce((v_ct->>'month_total_ves')::numeric, 0), coalesce((v_ct->>'previously_deducted_ves')::numeric, 0),
      coalesce((v_ct->>'amount_ves')::numeric, 0), coalesce((v_ct->>'amount')::numeric, 0),
      (v_ct->>'parameters_version_id')::uuid, v_uid
    ) RETURNING id INTO v_new_id;

    v_ct_total := v_ct_total + coalesce((v_ct->>'amount')::numeric, 0);
    v_ct_ids := v_ct_ids || jsonb_build_object(v_ct->>'key', v_new_id);
  END LOOP;

  FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(_items, '[]'::jsonb)) LOOP
    v_amount := coalesce((v_item->>'amount')::numeric, 0);
    v_key := v_item->>'withholding_key';
    v_ct_key := v_item->>'contribution_key';
    IF v_key IS NOT NULL AND NOT (v_ids ? v_key) THEN
      RAISE EXCEPTION 'INVALID_PAYMENT: línea con una retención desconocida';
    END IF;
    IF v_ct_key IS NOT NULL AND NOT (v_ct_ids ? v_ct_key) THEN
      RAISE EXCEPTION 'INVALID_PAYMENT: línea con un parafiscal desconocido';
    END IF;

    INSERT INTO public.payroll_payment_items
      (payment_id, concept_id, concept_kind, description, amount, withholding_id, contribution_id)
    VALUES (
      _payment.id, (v_item->>'concept_id')::uuid, v_item->>'concept_kind', v_item->>'description',
      v_amount,
      CASE WHEN v_key IS NULL THEN NULL ELSE (v_ids->>v_key)::uuid END,
      CASE WHEN v_ct_key IS NULL THEN NULL ELSE (v_ct_ids->>v_ct_key)::uuid END
    );

    IF v_item->>'concept_kind' = 'deduction' THEN
      v_deductions := v_deductions + v_amount;
      IF v_key IS NOT NULL THEN v_item_wh_total := v_item_wh_total + v_amount; END IF;
      IF v_ct_key IS NOT NULL THEN v_item_ct_total := v_item_ct_total + v_amount; END IF;
    ELSE
      v_gross := v_gross + v_amount;
    END IF;
  END LOOP;

  IF round(v_wh_total, 2) <> round(v_item_wh_total, 2) THEN
    RAISE EXCEPTION 'INVALID_PAYMENT: las retenciones no cuadran con las líneas del pago';
  END IF;
  IF round(v_ct_total, 2) <> round(v_item_ct_total, 2) THEN
    RAISE EXCEPTION 'INVALID_PAYMENT: los parafiscales no cuadran con las líneas del pago';
  END IF;
  IF v_deductions > v_gross THEN
    RAISE EXCEPTION 'INVALID_PAYMENT: las deducciones superan a las asignaciones';
  END IF;

  v_net := v_gross - v_deductions;
  UPDATE public.payroll_payments SET
    gross_amount = round(v_gross, 2),
    deductions_amount = round(v_deductions, 2),
    net_amount = round(v_net, 2),
    net_amount_ves = round(CASE WHEN _payment.currency = 'VES' THEN v_net ELSE v_net * _payment.exchange_rate END, 2),
    updated_at = now()
  WHERE id = _payment.id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.write_payroll_payment_lines(public.payroll_payments, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.write_payroll_payment_lines(public.payroll_payments, jsonb, jsonb, jsonb, jsonb) TO authenticated, service_role;

-- jsonb array of ids → uuid[] (NULL when absent).
CREATE OR REPLACE FUNCTION public.payroll_jsonb_uuid_array(_value jsonb)
RETURNS uuid[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN jsonb_typeof(_value) = 'array'
    THEN ARRAY(SELECT jsonb_array_elements_text(_value)::uuid)
    ELSE NULL END
$$;

CREATE OR REPLACE FUNCTION public.register_payroll_payment_with_withholdings(_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_school_id uuid := (_payload->>'school_id')::uuid;
  v_payment public.payroll_payments;
  v_beneficiary public.payroll_beneficiaries;
  v_doc jsonb;
  v_doc_id uuid;
  v_docs jsonb := '{}'::jsonb;
  v_kind text := coalesce(_payload->>'payment_kind', 'payroll');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_ALLOWED: sesión no válida';
  END IF;
  IF NOT public.payroll_can(v_school_id, 'payroll.register') THEN
    RAISE EXCEPTION 'NOT_ALLOWED: no tiene permiso para registrar pagos de nómina';
  END IF;

  SELECT * INTO v_beneficiary FROM public.payroll_beneficiaries
   WHERE id = (_payload->>'beneficiary_id')::uuid AND school_id = v_school_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_PAYMENT: beneficiario no encontrado en este colegio';
  END IF;
  IF v_beneficiary.payment_regime <> v_kind THEN
    RAISE EXCEPTION 'INVALID_PAYMENT: el tipo de pago no corresponde a este beneficiario';
  END IF;
  IF v_kind = 'invoice' AND jsonb_array_length(coalesce(_payload->'documents', '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'INVALID_PAYMENT: debe indicar al menos una factura';
  END IF;

  INSERT INTO public.payroll_payments (
    school_id, period_id, beneficiary_id, payment_kind, status, currency, exchange_rate,
    payment_method_id, payment_date, notes, month_base_payment_ids, created_by
  ) VALUES (
    v_school_id, (_payload->>'period_id')::uuid, v_beneficiary.id, v_kind, 'draft',
    coalesce(_payload->>'currency', 'VES'), coalesce((_payload->>'exchange_rate')::numeric, 1),
    (_payload->>'payment_method_id')::uuid, (_payload->>'payment_date')::date,
    _payload->>'notes', public.payroll_jsonb_uuid_array(_payload->'month_base_payment_ids'), v_uid
  ) RETURNING * INTO v_payment;

  FOR v_doc IN SELECT * FROM jsonb_array_elements(coalesce(_payload->'documents', '[]'::jsonb)) LOOP
    INSERT INTO public.payroll_purchase_documents (
      school_id, payment_id, beneficiary_id, document_type, document_number, control_number,
      issue_date, taxable_base, exempt_amount, vat_rate_pct, vat_amount, total_amount,
      islr_concept_id, is_petty_cash, is_vat_not_itemized, is_non_compliant
    ) VALUES (
      v_school_id, v_payment.id, v_beneficiary.id, coalesce(v_doc->>'document_type', 'invoice'),
      btrim(v_doc->>'document_number'), btrim(v_doc->>'control_number'), (v_doc->>'issue_date')::date,
      coalesce((v_doc->>'taxable_base')::numeric, 0), coalesce((v_doc->>'exempt_amount')::numeric, 0),
      coalesce((v_doc->>'vat_rate_pct')::numeric, 0), coalesce((v_doc->>'vat_amount')::numeric, 0),
      coalesce((v_doc->>'total_amount')::numeric, 0), (v_doc->>'islr_concept_id')::uuid,
      coalesce((v_doc->>'is_petty_cash')::boolean, false),
      coalesce((v_doc->>'is_vat_not_itemized')::boolean, false),
      coalesce((v_doc->>'is_non_compliant')::boolean, false)
    ) RETURNING id INTO v_doc_id;
    v_docs := v_docs || jsonb_build_object(v_doc->>'key', v_doc_id);
  END LOOP;

  PERFORM public.write_payroll_payment_lines(
    v_payment, _payload->'items', _payload->'withholdings', _payload->'contributions', v_docs);

  INSERT INTO public.payroll_audit_log (school_id, payment_id, action, actor_id, detail)
  VALUES (v_school_id, v_payment.id, 'created', v_uid, jsonb_build_object(
    'documents', jsonb_array_length(coalesce(_payload->'documents', '[]'::jsonb)),
    'withholdings', jsonb_array_length(coalesce(_payload->'withholdings', '[]'::jsonb)),
    'contributions', jsonb_array_length(coalesce(_payload->'contributions', '[]'::jsonb)),
    'month_base_payment_ids', coalesce(_payload->'month_base_payment_ids', 'null'::jsonb),
    'overrides', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'tax_type', w->>'tax_type', 'rate_pct', w->>'rate_pct', 'reason', w->>'override_reason')), '[]'::jsonb)
      FROM jsonb_array_elements(coalesce(_payload->'withholdings', '[]'::jsonb)) w
      WHERE coalesce((w->>'is_override')::boolean, false)
    )
  ));

  RETURN v_payment.id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.register_payroll_payment_with_withholdings(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_payroll_payment_with_withholdings(jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.recalculate_payroll_payment_withholdings(_payment_id uuid, _payload jsonb)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_payment public.payroll_payments;
  v_docs jsonb;
BEGIN
  SELECT * INTO v_payment FROM public.payroll_payments WHERE id = _payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_PAYMENT: pago no encontrado';
  END IF;
  IF NOT public.payroll_can(v_payment.school_id, 'payroll.register') THEN
    RAISE EXCEPTION 'NOT_ALLOWED: no tiene permiso para recalcular este pago';
  END IF;
  IF v_payment.status NOT IN ('draft','approved') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT: solo se recalculan pagos sin pagar';
  END IF;

  SELECT coalesce(jsonb_object_agg(d.id::text, d.id), '{}'::jsonb) INTO v_docs
  FROM public.payroll_purchase_documents d WHERE d.payment_id = _payment_id;

  DELETE FROM public.payroll_payment_items WHERE payment_id = _payment_id;
  DELETE FROM public.payroll_withholdings WHERE payment_id = _payment_id;
  DELETE FROM public.payroll_contributions WHERE payment_id = _payment_id;

  UPDATE public.payroll_payments
     SET status = 'draft', approved_by = NULL, approved_at = NULL,
         month_base_payment_ids = public.payroll_jsonb_uuid_array(_payload->'month_base_payment_ids')
   WHERE id = _payment_id
   RETURNING * INTO v_payment;

  PERFORM public.write_payroll_payment_lines(
    v_payment, _payload->'items', _payload->'withholdings', _payload->'contributions', v_docs);

  INSERT INTO public.payroll_audit_log (school_id, payment_id, action, actor_id, detail)
  VALUES (v_payment.school_id, _payment_id, 'withholdings_recalculated', v_uid, jsonb_build_object(
    'month_base_payment_ids', coalesce(_payload->'month_base_payment_ids', 'null'::jsonb)));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.recalculate_payroll_payment_withholdings(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalculate_payroll_payment_withholdings(uuid, jsonb) TO authenticated, service_role;

-- Same as 20261105120000, plus two checks before paying: the contribution percentages used are
-- still in force, and the worker's payments of the month are still the ones summed up.
CREATE OR REPLACE FUNCTION public.mark_payroll_payment_paid(_payment_id uuid, _reference text, _payment_date date DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_payment public.payroll_payments;
  v_period public.payroll_periods;
  v_school public.schools;
  v_beneficiary public.payroll_beneficiaries;
  v_settings public.payroll_tax_settings;
  v_date date;
  v_wh public.payroll_withholdings;
  v_ct public.payroll_contributions;
  v_seq bigint;
  v_voucher text;
  v_start date;
  v_end date;
  v_current uuid;
  v_vat_seq bigint;
  v_islr_seq bigint;
  v_reference text := btrim(coalesce(_reference, ''));
  v_today date := (now() AT TIME ZONE 'America/Caracas')::date;
BEGIN
  SELECT * INTO v_payment FROM public.payroll_payments WHERE id = _payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_PAYMENT: pago no encontrado';
  END IF;
  IF NOT public.payroll_can(v_payment.school_id, 'payroll.approve') THEN
    RAISE EXCEPTION 'NOT_ALLOWED: no tiene permiso para pagar nómina';
  END IF;
  IF v_payment.status <> 'approved' THEN
    RAISE EXCEPTION 'INVALID_PAYMENT: solo se paga un pago aprobado';
  END IF;

  -- The reference proves the transfer was made; a payment can't be marked paid without it.
  IF v_reference = '' THEN
    RAISE EXCEPTION 'INVALID_PAYMENT: indique la referencia del pago';
  END IF;
  IF length(v_reference) > 100 THEN
    RAISE EXCEPTION 'INVALID_PAYMENT: la referencia no puede pasar de 100 caracteres';
  END IF;

  v_date := coalesce(_payment_date, v_today);
  IF v_date > v_today THEN
    RAISE EXCEPTION 'INVALID_PAYMENT: la fecha del pago no puede ser futura';
  END IF;

  -- A payment of the month registered or voided after this one was calculated changes its base.
  -- Payments registered before this check existed (NULL list) aren't held back.
  SELECT * INTO v_period FROM public.payroll_periods WHERE id = v_payment.period_id;
  IF v_payment.payment_kind = 'payroll' AND coalesce(v_period.apply_deductions, true)
     AND v_payment.month_base_payment_ids IS NOT NULL
     AND public.payroll_sorted_ids(v_payment.month_base_payment_ids)
         IS DISTINCT FROM public.payroll_month_prior_payment_ids(v_payment.id) THEN
    RAISE EXCEPTION 'WITHHOLDING_RATE_CHANGED: cambiaron los pagos de este mes del trabajador; recalcule el pago';
  END IF;

  FOR v_ct IN SELECT * FROM public.payroll_contributions WHERE payment_id = _payment_id LOOP
    SELECT id INTO v_current FROM public.payroll_contribution_parameters
     WHERE school_id = v_payment.school_id AND valid_from <= v_date
     ORDER BY valid_from DESC LIMIT 1;
    IF v_current IS DISTINCT FROM v_ct.parameters_version_id THEN
      RAISE EXCEPTION 'WITHHOLDING_RATE_CHANGED: los porcentajes de parafiscales cambiaron; recalcule el pago';
    END IF;
  END LOOP;

  SELECT * INTO v_school FROM public.schools WHERE id = v_payment.school_id;
  SELECT * INTO v_beneficiary FROM public.payroll_beneficiaries WHERE id = v_payment.beneficiary_id;
  -- Serializes concurrent payments of a school so voucher numbers never repeat or skip.
  SELECT * INTO v_settings FROM public.payroll_tax_settings WHERE school_id = v_payment.school_id FOR UPDATE;
  v_vat_seq := coalesce(v_settings.next_vat_voucher_seq, 1);
  v_islr_seq := coalesce(v_settings.next_islr_voucher_seq, 1);

  FOR v_wh IN
    SELECT * FROM public.payroll_withholdings
     WHERE payment_id = _payment_id AND status = 'calculated'
     ORDER BY tax_type, created_at, id
  LOOP
    -- Rates in force on the payment date must still be the ones used.
    IF NOT v_wh.is_override THEN
      IF v_wh.parameters_version_id IS NOT NULL THEN
        SELECT id INTO v_current FROM public.payroll_tax_parameters
         WHERE school_id = v_payment.school_id AND valid_from <= v_date
         ORDER BY valid_from DESC LIMIT 1;
        IF v_current IS DISTINCT FROM v_wh.parameters_version_id THEN
          RAISE EXCEPTION 'WITHHOLDING_RATE_CHANGED: los parámetros de retención cambiaron; recalcule el pago';
        END IF;
      END IF;
      IF v_wh.islr_rate_version_id IS NOT NULL THEN
        SELECT id INTO v_current FROM public.payroll_islr_rate_versions
         WHERE concept_id = v_wh.islr_concept_id AND person_type = v_wh.person_type AND valid_from <= v_date
         ORDER BY valid_from DESC LIMIT 1;
        IF v_current IS DISTINCT FROM v_wh.islr_rate_version_id THEN
          RAISE EXCEPTION 'WITHHOLDING_RATE_CHANGED: el porcentaje de ISLR cambió; recalcule el pago';
        END IF;
      END IF;
      IF v_wh.ari_rate_id IS NOT NULL THEN
        SELECT id INTO v_current FROM public.payroll_beneficiary_ari_rates
         WHERE beneficiary_id = v_wh.beneficiary_id AND valid_from <= v_date
         ORDER BY valid_from DESC LIMIT 1;
        IF v_current IS DISTINCT FROM v_wh.ari_rate_id THEN
          RAISE EXCEPTION 'WITHHOLDING_RATE_CHANGED: el porcentaje de AR-I cambió; recalcule el pago';
        END IF;
      END IF;
    END IF;

    v_voucher := NULL;
    IF v_wh.source = 'invoice' AND v_wh.withheld_ves > 0 THEN
      IF v_wh.tax_type = 'vat' THEN
        v_seq := v_vat_seq;
        v_vat_seq := CASE WHEN v_vat_seq >= 99999999 THEN 1 ELSE v_vat_seq + 1 END;
      ELSE
        v_seq := v_islr_seq;
        v_islr_seq := CASE WHEN v_islr_seq >= 99999999 THEN 1 ELSE v_islr_seq + 1 END;
      END IF;
      v_voucher := to_char(v_date, 'YYYYMM') || lpad(v_seq::text, 8, '0');
    END IF;

    IF v_wh.tax_type = 'vat' THEN
      IF extract(day FROM v_date) <= 15 THEN
        v_start := date_trunc('month', v_date)::date;
        v_end := v_start + 14;
      ELSE
        v_start := date_trunc('month', v_date)::date + 15;
        v_end := (date_trunc('month', v_date) + interval '1 month - 1 day')::date;
      END IF;
    ELSE
      v_start := date_trunc('month', v_date)::date;
      v_end := (date_trunc('month', v_date) + interval '1 month - 1 day')::date;
    END IF;

    UPDATE public.payroll_withholdings SET
      status = 'issued',
      voucher_number = v_voucher,
      issued_at = now(),
      fiscal_period_start = v_start,
      fiscal_period_end = v_end,
      beneficiary_snapshot = jsonb_build_object(
        'name', v_beneficiary.full_name, 'tax_id', v_beneficiary.tax_id,
        'document_id', v_beneficiary.document_id, 'fiscal_address', v_beneficiary.fiscal_address,
        'email', v_beneficiary.email),
      agent_snapshot = jsonb_build_object(
        'name', v_school.name, 'tax_id', v_school.rif, 'fiscal_address', v_school.address)
    WHERE id = v_wh.id;
  END LOOP;

  IF v_settings.school_id IS NOT NULL THEN
    UPDATE public.payroll_tax_settings
       SET next_vat_voucher_seq = v_vat_seq, next_islr_voucher_seq = v_islr_seq, updated_at = now()
     WHERE school_id = v_payment.school_id;
  END IF;

  UPDATE public.payroll_payments SET
    status = 'paid', paid_by = v_uid, paid_at = now(), payment_date = v_date,
    payment_reference = v_reference, updated_at = now()
  WHERE id = _payment_id;

  INSERT INTO public.payroll_audit_log (school_id, payment_id, action, actor_id, detail)
  VALUES (v_payment.school_id, _payment_id, 'paid', v_uid,
          jsonb_build_object('reference', v_reference, 'payment_date', v_date));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.mark_payroll_payment_paid(uuid, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_payroll_payment_paid(uuid, text, date) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
