-- Paying a payroll payment now requires the bank reference of the transfer, and its date can't be
-- in the future. The reference is kept on the payment and shown on receipts and exports.

ALTER TABLE public.payroll_payments ADD COLUMN IF NOT EXISTS payment_reference text;

-- The old two-argument version is dropped so no caller can still pay without a reference.
DROP FUNCTION IF EXISTS public.mark_payroll_payment_paid(uuid, date);

CREATE OR REPLACE FUNCTION public.mark_payroll_payment_paid(_payment_id uuid, _reference text, _payment_date date DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_payment public.payroll_payments;
  v_school public.schools;
  v_beneficiary public.payroll_beneficiaries;
  v_settings public.payroll_tax_settings;
  v_date date;
  v_wh public.payroll_withholdings;
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
