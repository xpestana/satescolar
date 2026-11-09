-- Unjustified absences are discounted by hours: hours not worked × (base salary of the month ÷
-- hours the worker works a month), rounded only at the end. Not a concept: the payment form asks
-- for the hours and adds the line. Each worker keeps how many hours a month they work, and the
-- school marks which concept is the base salary.

ALTER TABLE public.payroll_beneficiaries
  ADD COLUMN IF NOT EXISTS monthly_hours numeric;
ALTER TABLE public.payroll_beneficiaries
  DROP CONSTRAINT IF EXISTS payroll_beneficiaries_monthly_hours_check;
ALTER TABLE public.payroll_beneficiaries
  ADD CONSTRAINT payroll_beneficiaries_monthly_hours_check CHECK (monthly_hours IS NULL OR (monthly_hours > 0 AND monthly_hours <= 744));

ALTER TABLE public.payroll_concepts
  ADD COLUMN IF NOT EXISTS is_base_salary boolean NOT NULL DEFAULT false;

-- Set on the discount line: the hours it discounts. Lets the payroll sheet show it in its column.
ALTER TABLE public.payroll_payment_items
  ADD COLUMN IF NOT EXISTS unpaid_hours numeric;
ALTER TABLE public.payroll_payment_items
  DROP CONSTRAINT IF EXISTS payroll_payment_items_unpaid_hours_check;
ALTER TABLE public.payroll_payment_items
  ADD CONSTRAINT payroll_payment_items_unpaid_hours_check CHECK (unpaid_hours IS NULL OR unpaid_hours > 0);

-- Same as 20261106120000, plus the hours of the discount line.
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
  v_rate numeric := CASE WHEN _payment.currency = 'VES' THEN 1 ELSE coalesce(_payment.exchange_rate, 0) END;
  v_gross numeric := 0;
  v_deductions numeric := 0;
  v_gross_ves numeric := 0;
  v_deductions_ves numeric := 0;
  v_amount numeric;
  v_amount_ves numeric;
  -- Every line carries amount_ves: compare withholdings and contributions in bolívares.
  v_exact boolean := NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(_items, '[]'::jsonb)) i WHERE NOT (i ? 'amount_ves'));
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

  IF _payment.currency <> 'VES' AND v_rate <= 0 THEN
    RAISE EXCEPTION 'INVALID_PAYMENT: indique la tasa del dólar';
  END IF;

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

    v_wh_total := v_wh_total + CASE WHEN v_exact
      THEN coalesce((v_wh->>'withheld_ves')::numeric, 0)
      ELSE coalesce((v_wh->>'withheld_amount')::numeric, 0) END;
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

    v_ct_total := v_ct_total + CASE WHEN v_exact
      THEN coalesce((v_ct->>'amount_ves')::numeric, 0)
      ELSE coalesce((v_ct->>'amount')::numeric, 0) END;
    v_ct_ids := v_ct_ids || jsonb_build_object(v_ct->>'key', v_new_id);
  END LOOP;

  FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(_items, '[]'::jsonb)) LOOP
    v_amount := coalesce((v_item->>'amount')::numeric, 0);
    -- In bolívares a line is its own amount; in dollars, what the app calculated, or the conversion.
    v_amount_ves := CASE
      WHEN _payment.currency = 'VES' THEN round(v_amount, 2)
      WHEN v_item ? 'amount_ves' THEN round((v_item->>'amount_ves')::numeric, 2)
      ELSE round(v_amount * v_rate, 2) END;
    v_key := v_item->>'withholding_key';
    v_ct_key := v_item->>'contribution_key';
    IF v_key IS NOT NULL AND NOT (v_ids ? v_key) THEN
      RAISE EXCEPTION 'INVALID_PAYMENT: línea con una retención desconocida';
    END IF;
    IF v_ct_key IS NOT NULL AND NOT (v_ct_ids ? v_ct_key) THEN
      RAISE EXCEPTION 'INVALID_PAYMENT: línea con un parafiscal desconocido';
    END IF;
    IF (v_item->>'unpaid_hours') IS NOT NULL AND v_item->>'concept_kind' <> 'deduction' THEN
      RAISE EXCEPTION 'INVALID_PAYMENT: las horas no trabajadas solo pueden ser un descuento';
    END IF;
    IF v_amount < 0 OR v_amount_ves < 0 THEN
      RAISE EXCEPTION 'INVALID_PAYMENT: los montos no pueden ser negativos';
    END IF;

    INSERT INTO public.payroll_payment_items
      (payment_id, concept_id, concept_kind, description, amount, amount_ves, withholding_id, contribution_id, unpaid_hours)
    VALUES (
      _payment.id, (v_item->>'concept_id')::uuid, v_item->>'concept_kind', v_item->>'description',
      v_amount, v_amount_ves,
      CASE WHEN v_key IS NULL THEN NULL ELSE (v_ids->>v_key)::uuid END,
      CASE WHEN v_ct_key IS NULL THEN NULL ELSE (v_ct_ids->>v_ct_key)::uuid END,
      (v_item->>'unpaid_hours')::numeric
    );

    IF v_item->>'concept_kind' = 'deduction' THEN
      v_deductions := v_deductions + v_amount;
      v_deductions_ves := v_deductions_ves + v_amount_ves;
      IF v_key IS NOT NULL THEN
        v_item_wh_total := v_item_wh_total + CASE WHEN v_exact THEN v_amount_ves ELSE v_amount END;
      END IF;
      IF v_ct_key IS NOT NULL THEN
        v_item_ct_total := v_item_ct_total + CASE WHEN v_exact THEN v_amount_ves ELSE v_amount END;
      END IF;
    ELSE
      v_gross := v_gross + v_amount;
      v_gross_ves := v_gross_ves + v_amount_ves;
    END IF;
  END LOOP;

  IF round(v_wh_total, 2) <> round(v_item_wh_total, 2) THEN
    RAISE EXCEPTION 'INVALID_PAYMENT: las retenciones no cuadran con las líneas del pago';
  END IF;
  IF round(v_ct_total, 2) <> round(v_item_ct_total, 2) THEN
    RAISE EXCEPTION 'INVALID_PAYMENT: los parafiscales no cuadran con las líneas del pago';
  END IF;
  IF round(v_deductions_ves, 2) > round(v_gross_ves, 2) THEN
    RAISE EXCEPTION 'INVALID_PAYMENT: las deducciones superan a las asignaciones';
  END IF;

  UPDATE public.payroll_payments SET
    gross_amount = round(v_gross, 2),
    deductions_amount = round(v_deductions, 2),
    net_amount = greatest(round(v_gross - v_deductions, 2), 0),
    -- What is actually transferred: the lines in bolívares, each already rounded.
    net_amount_ves = round(v_gross_ves - v_deductions_ves, 2),
    updated_at = now()
  WHERE id = _payment.id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.write_payroll_payment_lines(public.payroll_payments, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.write_payroll_payment_lines(public.payroll_payments, jsonb, jsonb, jsonb, jsonb) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
