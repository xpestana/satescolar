-- IVA / ISLR withholdings inside the payroll module.
-- Additive: every school starts with withholdings OFF and existing payroll behaviour unchanged.
-- Rates are versioned (never overwritten) and each withholding keeps a copy of what it used,
-- so changing a percentage in settings never alters past payments.

-- ── 1. Existing tables ───────────────────────────────────────────────────────

ALTER TABLE public.payroll_beneficiaries
  DROP CONSTRAINT IF EXISTS payroll_beneficiaries_category_check;
ALTER TABLE public.payroll_beneficiaries
  ADD CONSTRAINT payroll_beneficiaries_category_check
  CHECK (category IN ('teacher','admin','worker','supplier','other'));

ALTER TABLE public.payroll_beneficiaries
  ADD COLUMN IF NOT EXISTS payment_regime text NOT NULL DEFAULT 'payroll',
  ADD COLUMN IF NOT EXISTS person_type text,
  ADD COLUMN IF NOT EXISTS tax_id text,
  ADD COLUMN IF NOT EXISTS fiscal_address text,
  ADD COLUMN IF NOT EXISTS vat_withholding_mode text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS vat_exclusion_reason text,
  ADD COLUMN IF NOT EXISTS default_islr_concept_id uuid;

ALTER TABLE public.payroll_beneficiaries
  DROP CONSTRAINT IF EXISTS payroll_beneficiaries_regime_check,
  DROP CONSTRAINT IF EXISTS payroll_beneficiaries_supplier_regime_check,
  DROP CONSTRAINT IF EXISTS payroll_beneficiaries_person_type_check,
  DROP CONSTRAINT IF EXISTS payroll_beneficiaries_vat_mode_check,
  DROP CONSTRAINT IF EXISTS payroll_beneficiaries_vat_exclusion_check;
ALTER TABLE public.payroll_beneficiaries
  ADD CONSTRAINT payroll_beneficiaries_regime_check
    CHECK (payment_regime IN ('payroll','invoice')),
  ADD CONSTRAINT payroll_beneficiaries_supplier_regime_check
    CHECK (category <> 'supplier' OR payment_regime = 'invoice'),
  ADD CONSTRAINT payroll_beneficiaries_person_type_check
    CHECK (person_type IS NULL OR person_type IN
      ('natural_resident','natural_non_resident','legal_domiciled','legal_non_domiciled')),
  ADD CONSTRAINT payroll_beneficiaries_vat_mode_check
    CHECK (vat_withholding_mode IN ('standard','full','excluded')),
  ADD CONSTRAINT payroll_beneficiaries_vat_exclusion_check
    CHECK (vat_withholding_mode <> 'excluded' OR coalesce(btrim(vat_exclusion_reason), '') <> '');

CREATE UNIQUE INDEX IF NOT EXISTS payroll_beneficiaries_school_tax_id_uq
  ON public.payroll_beneficiaries(school_id, tax_id)
  WHERE tax_id IS NOT NULL;

ALTER TABLE public.payroll_payments
  ADD COLUMN IF NOT EXISTS payment_kind text NOT NULL DEFAULT 'payroll';
ALTER TABLE public.payroll_payments
  DROP CONSTRAINT IF EXISTS payroll_payments_kind_check;
ALTER TABLE public.payroll_payments
  ADD CONSTRAINT payroll_payments_kind_check CHECK (payment_kind IN ('payroll','invoice'));

-- "One live payment per period" stays for salaries; a supplier can bill several times.
DROP INDEX IF EXISTS public.payroll_payments_period_beneficiary_uq;
CREATE UNIQUE INDEX payroll_payments_period_beneficiary_uq
  ON public.payroll_payments(period_id, beneficiary_id)
  WHERE status <> 'voided' AND payment_kind = 'payroll';

ALTER TABLE public.payroll_concepts
  ADD COLUMN IF NOT EXISTS is_islr_taxable boolean NOT NULL DEFAULT true;

-- ── 2. New tables ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payroll_tax_settings (
  school_id uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  vat_agent_enabled boolean NOT NULL DEFAULT false,
  islr_agent_enabled boolean NOT NULL DEFAULT false,
  next_vat_voucher_seq bigint NOT NULL DEFAULT 1 CHECK (next_vat_voucher_seq >= 1),
  next_islr_voucher_seq bigint NOT NULL DEFAULT 1 CHECK (next_islr_voucher_seq >= 1),
  rates_validated_at timestamptz,
  rates_validated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payroll_tax_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  valid_from date NOT NULL,
  vat_standard_pct numeric NOT NULL DEFAULT 75 CHECK (vat_standard_pct BETWEEN 0 AND 100),
  vat_full_pct numeric NOT NULL DEFAULT 100 CHECK (vat_full_pct BETWEEN 0 AND 100),
  default_vat_rate_pct numeric NOT NULL DEFAULT 16 CHECK (default_vat_rate_pct BETWEEN 0 AND 100),
  tax_unit_value numeric NOT NULL CHECK (tax_unit_value > 0),
  petty_cash_ut_limit numeric NOT NULL DEFAULT 20 CHECK (petty_cash_ut_limit >= 0),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payroll_tax_parameters_school_date_uq UNIQUE (school_id, valid_from)
);

CREATE TABLE IF NOT EXISTS public.payroll_islr_concepts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (btrim(name) <> ''),
  seniat_code text,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payroll_islr_concepts_school_name_uq UNIQUE (school_id, name)
);

ALTER TABLE public.payroll_beneficiaries
  DROP CONSTRAINT IF EXISTS payroll_beneficiaries_default_islr_concept_fk;
ALTER TABLE public.payroll_beneficiaries
  ADD CONSTRAINT payroll_beneficiaries_default_islr_concept_fk
  FOREIGN KEY (default_islr_concept_id) REFERENCES public.payroll_islr_concepts(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.payroll_islr_rate_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  concept_id uuid NOT NULL REFERENCES public.payroll_islr_concepts(id) ON DELETE RESTRICT,
  person_type text NOT NULL CHECK (person_type IN
    ('natural_resident','natural_non_resident','legal_domiciled','legal_non_domiciled')),
  valid_from date NOT NULL,
  base_pct numeric NOT NULL DEFAULT 100 CHECK (base_pct BETWEEN 0 AND 100),
  rate_pct numeric NOT NULL CHECK (rate_pct BETWEEN 0 AND 100),
  subtrahend_mode text NOT NULL DEFAULT 'none' CHECK (subtrahend_mode IN ('auto','manual','none')),
  subtrahend_amount numeric NOT NULL DEFAULT 0 CHECK (subtrahend_amount >= 0),
  minimum_mode text NOT NULL DEFAULT 'none' CHECK (minimum_mode IN ('auto','manual','none')),
  minimum_amount numeric NOT NULL DEFAULT 0 CHECK (minimum_amount >= 0),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payroll_islr_rate_versions_uq UNIQUE (concept_id, person_type, valid_from)
);

CREATE TABLE IF NOT EXISTS public.payroll_beneficiary_ari_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  beneficiary_id uuid NOT NULL REFERENCES public.payroll_beneficiaries(id) ON DELETE CASCADE,
  valid_from date NOT NULL,
  rate_pct numeric NOT NULL CHECK (rate_pct BETWEEN 0 AND 100),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payroll_beneficiary_ari_rates_uq UNIQUE (beneficiary_id, valid_from)
);

CREATE TABLE IF NOT EXISTS public.payroll_purchase_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  payment_id uuid NOT NULL REFERENCES public.payroll_payments(id) ON DELETE CASCADE,
  beneficiary_id uuid NOT NULL REFERENCES public.payroll_beneficiaries(id) ON DELETE RESTRICT,
  document_type text NOT NULL DEFAULT 'invoice' CHECK (document_type IN ('invoice','debit_note')),
  document_number text NOT NULL CHECK (btrim(document_number) <> ''),
  control_number text NOT NULL CHECK (btrim(control_number) <> ''),
  issue_date date NOT NULL,
  taxable_base numeric NOT NULL DEFAULT 0 CHECK (taxable_base >= 0),
  exempt_amount numeric NOT NULL DEFAULT 0 CHECK (exempt_amount >= 0),
  vat_rate_pct numeric NOT NULL DEFAULT 0 CHECK (vat_rate_pct BETWEEN 0 AND 100),
  vat_amount numeric NOT NULL DEFAULT 0 CHECK (vat_amount >= 0),
  total_amount numeric NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  islr_concept_id uuid REFERENCES public.payroll_islr_concepts(id) ON DELETE SET NULL,
  is_petty_cash boolean NOT NULL DEFAULT false,
  is_vat_not_itemized boolean NOT NULL DEFAULT false,
  is_non_compliant boolean NOT NULL DEFAULT false,
  is_voided boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- The same invoice can't be registered twice; voiding the payment frees it again.
CREATE UNIQUE INDEX IF NOT EXISTS payroll_purchase_documents_uq
  ON public.payroll_purchase_documents(school_id, beneficiary_id, document_type, document_number, control_number)
  WHERE NOT is_voided;

CREATE TABLE IF NOT EXISTS public.payroll_withholdings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  payment_id uuid NOT NULL REFERENCES public.payroll_payments(id) ON DELETE RESTRICT,
  document_id uuid REFERENCES public.payroll_purchase_documents(id) ON DELETE RESTRICT,
  beneficiary_id uuid NOT NULL REFERENCES public.payroll_beneficiaries(id) ON DELETE RESTRICT,
  tax_type text NOT NULL CHECK (tax_type IN ('vat','islr')),
  source text NOT NULL CHECK (source IN ('invoice','salary')),
  status text NOT NULL DEFAULT 'calculated'
    CHECK (status IN ('calculated','issued','declared','remitted','voided')),
  -- What was used for the calculation (frozen once issued).
  base_ves numeric NOT NULL DEFAULT 0 CHECK (base_ves >= 0),
  base_pct numeric NOT NULL DEFAULT 100,
  rate_pct numeric NOT NULL DEFAULT 0,
  tax_amount_ves numeric NOT NULL DEFAULT 0 CHECK (tax_amount_ves >= 0),
  subtrahend_ves numeric NOT NULL DEFAULT 0 CHECK (subtrahend_ves >= 0),
  minimum_ves numeric NOT NULL DEFAULT 0 CHECK (minimum_ves >= 0),
  tax_unit_value numeric,
  exchange_rate numeric NOT NULL DEFAULT 1,
  withheld_ves numeric NOT NULL DEFAULT 0 CHECK (withheld_ves >= 0),
  withheld_amount numeric NOT NULL DEFAULT 0 CHECK (withheld_amount >= 0),
  no_withholding_reason text,
  islr_concept_id uuid REFERENCES public.payroll_islr_concepts(id) ON DELETE SET NULL,
  islr_concept_name text,
  islr_seniat_code text,
  person_type text,
  parameters_version_id uuid REFERENCES public.payroll_tax_parameters(id) ON DELETE SET NULL,
  islr_rate_version_id uuid REFERENCES public.payroll_islr_rate_versions(id) ON DELETE SET NULL,
  ari_rate_id uuid REFERENCES public.payroll_beneficiary_ari_rates(id) ON DELETE SET NULL,
  is_override boolean NOT NULL DEFAULT false,
  override_reason text,
  beneficiary_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  agent_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Tracking.
  fiscal_period_start date,
  fiscal_period_end date,
  voucher_number text,
  issued_at timestamptz,
  delivered_at timestamptz,
  declared_at date,
  declaration_ref text,
  remitted_at date,
  remittance_ref text,
  voided_at timestamptz,
  voided_by uuid REFERENCES auth.users(id),
  void_reason text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payroll_withholdings_override_check
    CHECK (NOT is_override OR coalesce(btrim(override_reason), '') <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS payroll_withholdings_voucher_uq
  ON public.payroll_withholdings(school_id, tax_type, voucher_number)
  WHERE voucher_number IS NOT NULL;

ALTER TABLE public.payroll_payment_items
  ADD COLUMN IF NOT EXISTS withholding_id uuid;
ALTER TABLE public.payroll_payment_items
  DROP CONSTRAINT IF EXISTS payroll_payment_items_withholding_fk;
ALTER TABLE public.payroll_payment_items
  ADD CONSTRAINT payroll_payment_items_withholding_fk
  FOREIGN KEY (withholding_id) REFERENCES public.payroll_withholdings(id) ON DELETE SET NULL;

-- ── 3. Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_payroll_islr_concepts_school ON public.payroll_islr_concepts(school_id);
CREATE INDEX IF NOT EXISTS idx_payroll_islr_rates_school ON public.payroll_islr_rate_versions(school_id);
CREATE INDEX IF NOT EXISTS idx_payroll_ari_rates_school ON public.payroll_beneficiary_ari_rates(school_id);
CREATE INDEX IF NOT EXISTS idx_payroll_documents_payment ON public.payroll_purchase_documents(payment_id);
CREATE INDEX IF NOT EXISTS idx_payroll_documents_beneficiary ON public.payroll_purchase_documents(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_payroll_withholdings_payment ON public.payroll_withholdings(payment_id);
CREATE INDEX IF NOT EXISTS idx_payroll_withholdings_document ON public.payroll_withholdings(document_id);
CREATE INDEX IF NOT EXISTS idx_payroll_withholdings_beneficiary ON public.payroll_withholdings(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_payroll_withholdings_period
  ON public.payroll_withholdings(school_id, tax_type, fiscal_period_start);
CREATE INDEX IF NOT EXISTS idx_payroll_items_withholding ON public.payroll_payment_items(withholding_id);

-- ── 4. Permissions helper + permission key ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.payroll_can(_school_id uuid, _key text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT public.is_admin()
    OR (public.is_school_staff(_school_id) AND public.has_permission(auth.uid(), _key))
$$;
REVOKE EXECUTE ON FUNCTION public.payroll_can(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.payroll_can(uuid, text) TO authenticated, service_role;

INSERT INTO public.permission_keys (key, module, label, supports_scope, display_order) VALUES
  ('payroll.withholdings','Pagos','Gestionar retenciones (comprobantes y declaraciones)',false,78)
ON CONFLICT (key) DO NOTHING;

-- ── 5. Row Level Security ────────────────────────────────────────────────────

ALTER TABLE public.payroll_tax_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_tax_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_islr_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_islr_rate_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_beneficiary_ari_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_purchase_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_withholdings ENABLE ROW LEVEL SECURITY;

-- Staff of the school can read everything here; admins manage all.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'payroll_tax_settings','payroll_tax_parameters','payroll_islr_concepts',
    'payroll_islr_rate_versions','payroll_beneficiary_ari_rates',
    'payroll_purchase_documents','payroll_withholdings'
  ];
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

-- Settings and concepts: whoever configures payroll.
DROP POLICY IF EXISTS "Config manages payroll_tax_settings" ON public.payroll_tax_settings;
CREATE POLICY "Config manages payroll_tax_settings" ON public.payroll_tax_settings FOR ALL
  USING (public.payroll_can(school_id, 'payroll.config'))
  WITH CHECK (public.payroll_can(school_id, 'payroll.config'));

DROP POLICY IF EXISTS "Config manages payroll_islr_concepts" ON public.payroll_islr_concepts;
CREATE POLICY "Config manages payroll_islr_concepts" ON public.payroll_islr_concepts FOR ALL
  USING (public.payroll_can(school_id, 'payroll.config'))
  WITH CHECK (public.payroll_can(school_id, 'payroll.config'));

-- Versioned rates: add new ones; only future-dated versions can be deleted. Never updated.
DROP POLICY IF EXISTS "Config adds payroll_tax_parameters" ON public.payroll_tax_parameters;
CREATE POLICY "Config adds payroll_tax_parameters" ON public.payroll_tax_parameters FOR INSERT
  WITH CHECK (public.payroll_can(school_id, 'payroll.config'));
DROP POLICY IF EXISTS "Config deletes future payroll_tax_parameters" ON public.payroll_tax_parameters;
CREATE POLICY "Config deletes future payroll_tax_parameters" ON public.payroll_tax_parameters FOR DELETE
  USING (valid_from > current_date AND public.payroll_can(school_id, 'payroll.config'));

DROP POLICY IF EXISTS "Config adds payroll_islr_rate_versions" ON public.payroll_islr_rate_versions;
CREATE POLICY "Config adds payroll_islr_rate_versions" ON public.payroll_islr_rate_versions FOR INSERT
  WITH CHECK (public.payroll_can(school_id, 'payroll.config'));
DROP POLICY IF EXISTS "Config deletes future payroll_islr_rate_versions" ON public.payroll_islr_rate_versions;
CREATE POLICY "Config deletes future payroll_islr_rate_versions" ON public.payroll_islr_rate_versions FOR DELETE
  USING (valid_from > current_date AND public.payroll_can(school_id, 'payroll.config'));

-- AR-I belongs to the beneficiary's record, so whoever registers beneficiaries adds it.
DROP POLICY IF EXISTS "Register adds payroll_beneficiary_ari_rates" ON public.payroll_beneficiary_ari_rates;
CREATE POLICY "Register adds payroll_beneficiary_ari_rates" ON public.payroll_beneficiary_ari_rates FOR INSERT
  WITH CHECK (public.payroll_can(school_id, 'payroll.register'));
DROP POLICY IF EXISTS "Register deletes future payroll_beneficiary_ari_rates" ON public.payroll_beneficiary_ari_rates;
CREATE POLICY "Register deletes future payroll_beneficiary_ari_rates" ON public.payroll_beneficiary_ari_rates FOR DELETE
  USING (valid_from > current_date AND public.payroll_can(school_id, 'payroll.register'));

-- Documents and withholdings are written by the RPCs below, which run as the caller.
DROP POLICY IF EXISTS "Register writes payroll_purchase_documents" ON public.payroll_purchase_documents;
CREATE POLICY "Register writes payroll_purchase_documents" ON public.payroll_purchase_documents FOR ALL
  USING (public.payroll_can(school_id, 'payroll.register') OR public.payroll_can(school_id, 'payroll.approve'))
  WITH CHECK (public.payroll_can(school_id, 'payroll.register') OR public.payroll_can(school_id, 'payroll.approve'));

DROP POLICY IF EXISTS "Payroll writes payroll_withholdings" ON public.payroll_withholdings;
CREATE POLICY "Payroll writes payroll_withholdings" ON public.payroll_withholdings FOR ALL
  USING (
    public.payroll_can(school_id, 'payroll.register')
    OR public.payroll_can(school_id, 'payroll.approve')
    OR public.payroll_can(school_id, 'payroll.withholdings')
  )
  WITH CHECK (
    public.payroll_can(school_id, 'payroll.register')
    OR public.payroll_can(school_id, 'payroll.approve')
    OR public.payroll_can(school_id, 'payroll.withholdings')
  );

-- ── 6. Guards ────────────────────────────────────────────────────────────────

-- Once issued, what a withholding used can't change, and a declared one can't be voided.
CREATE OR REPLACE FUNCTION public.guard_payroll_withholding()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'calculated' THEN
      RAISE EXCEPTION 'WITHHOLDING_LOCKED: una retención emitida no se puede borrar';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status <> 'calculated' AND (
    NEW.base_ves, NEW.base_pct, NEW.rate_pct, NEW.tax_amount_ves, NEW.subtrahend_ves, NEW.minimum_ves,
    NEW.tax_unit_value, NEW.exchange_rate, NEW.withheld_ves, NEW.withheld_amount, NEW.tax_type,
    NEW.beneficiary_snapshot, NEW.agent_snapshot, NEW.voucher_number,
    NEW.fiscal_period_start, NEW.fiscal_period_end, NEW.is_override, NEW.override_reason
  ) IS DISTINCT FROM (
    OLD.base_ves, OLD.base_pct, OLD.rate_pct, OLD.tax_amount_ves, OLD.subtrahend_ves, OLD.minimum_ves,
    OLD.tax_unit_value, OLD.exchange_rate, OLD.withheld_ves, OLD.withheld_amount, OLD.tax_type,
    OLD.beneficiary_snapshot, OLD.agent_snapshot, OLD.voucher_number,
    OLD.fiscal_period_start, OLD.fiscal_period_end, OLD.is_override, OLD.override_reason
  ) THEN
    RAISE EXCEPTION 'WITHHOLDING_LOCKED: una retención emitida no se puede modificar';
  END IF;

  IF OLD.status IN ('declared','remitted') AND NEW.status = 'voided' THEN
    RAISE EXCEPTION 'WITHHOLDING_DECLARED: una retención declarada no se puede anular';
  END IF;

  IF OLD.status = 'voided' AND NEW.status <> 'voided' THEN
    RAISE EXCEPTION 'WITHHOLDING_LOCKED: una retención anulada no se puede reabrir';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_payroll_withholding ON public.payroll_withholdings;
CREATE TRIGGER trg_guard_payroll_withholding
  BEFORE UPDATE OR DELETE ON public.payroll_withholdings
  FOR EACH ROW EXECUTE FUNCTION public.guard_payroll_withholding();

-- A teacher added later from the Teachers area links to the payroll-only beneficiary with the
-- same document. Only the link is set; the beneficiary's own data stays as it is.
CREATE OR REPLACE FUNCTION public.link_payroll_beneficiary_to_teacher()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.document_id IS NOT NULL THEN
    UPDATE public.payroll_beneficiaries b
       SET teacher_id = NEW.id, updated_at = now()
     WHERE b.school_id = NEW.school_id
       AND b.category = 'teacher'
       AND b.teacher_id IS NULL
       AND b.document_id = NEW.document_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.link_payroll_beneficiary_to_teacher() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_link_payroll_beneficiary_to_teacher ON public.teachers;
CREATE TRIGGER trg_link_payroll_beneficiary_to_teacher
  AFTER INSERT OR UPDATE OF document_id ON public.teachers
  FOR EACH ROW EXECUTE FUNCTION public.link_payroll_beneficiary_to_teacher();

-- ── 7. Defaults for a school (values to be validated by its accountant) ──────

CREATE OR REPLACE FUNCTION public.ensure_payroll_tax_defaults(_school_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_from date := current_date;
  v_concept record;
  v_concept_id uuid;
BEGIN
  IF NOT public.payroll_can(_school_id, 'payroll.config') THEN
    RAISE EXCEPTION 'NOT_ALLOWED: no tiene permiso para configurar retenciones';
  END IF;

  INSERT INTO public.payroll_tax_settings (school_id) VALUES (_school_id)
  ON CONFLICT (school_id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.payroll_tax_parameters WHERE school_id = _school_id) THEN
    INSERT INTO public.payroll_tax_parameters (school_id, valid_from, tax_unit_value, created_by)
    VALUES (_school_id, v_from, 43, v_uid);
  END IF;

  IF EXISTS (SELECT 1 FROM public.payroll_islr_concepts WHERE school_id = _school_id) THEN
    RETURN;
  END IF;

  FOR v_concept IN
    SELECT * FROM (VALUES
      ('Honorarios profesionales', 1, 3::numeric, 'auto', 5::numeric),
      ('Contratistas y servicios', 2, 1::numeric, 'none', 2::numeric),
      ('Arrendamiento de bienes muebles', 3, 3::numeric, 'auto', 5::numeric),
      ('Publicidad y propaganda', 4, 3::numeric, 'auto', 5::numeric)
    ) AS d(name, display_order, natural_pct, natural_mode, legal_pct)
  LOOP
    INSERT INTO public.payroll_islr_concepts (school_id, name, display_order)
    VALUES (_school_id, v_concept.name, v_concept.display_order)
    RETURNING id INTO v_concept_id;

    INSERT INTO public.payroll_islr_rate_versions
      (school_id, concept_id, person_type, valid_from, rate_pct, subtrahend_mode, minimum_mode, created_by)
    VALUES
      (_school_id, v_concept_id, 'natural_resident', v_from, v_concept.natural_pct,
       v_concept.natural_mode, v_concept.natural_mode, v_uid),
      (_school_id, v_concept_id, 'legal_domiciled', v_from, v_concept.legal_pct, 'none', 'none', v_uid);
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.ensure_payroll_tax_defaults(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_payroll_tax_defaults(uuid) TO authenticated, service_role;

-- ── 8. Payment RPCs (run as the caller, so RLS still applies) ────────────────

-- Writes the lines and withholdings of a payment and recomputes its totals. Shared by
-- register and recalculate so both validate the same way.
CREATE OR REPLACE FUNCTION public.write_payroll_payment_lines(
  _payment public.payroll_payments,
  _items jsonb,
  _withholdings jsonb,
  _documents_by_key jsonb
)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_settings public.payroll_tax_settings;
  v_school public.schools;
  v_beneficiary public.payroll_beneficiaries;
  v_wh jsonb;
  v_item jsonb;
  v_ids jsonb := '{}'::jsonb;
  v_new_id uuid;
  v_key text;
  v_gross numeric := 0;
  v_deductions numeric := 0;
  v_net numeric;
  v_amount numeric;
  v_wh_total numeric := 0;
  v_item_wh_total numeric := 0;
BEGIN
  SELECT * INTO v_settings FROM public.payroll_tax_settings WHERE school_id = _payment.school_id;
  SELECT * INTO v_school FROM public.schools WHERE id = _payment.school_id;
  SELECT * INTO v_beneficiary FROM public.payroll_beneficiaries WHERE id = _payment.beneficiary_id;

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

  FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(_items, '[]'::jsonb)) LOOP
    v_amount := coalesce((v_item->>'amount')::numeric, 0);
    v_key := v_item->>'withholding_key';
    IF v_key IS NOT NULL AND NOT (v_ids ? v_key) THEN
      RAISE EXCEPTION 'INVALID_PAYMENT: línea con una retención desconocida';
    END IF;

    INSERT INTO public.payroll_payment_items
      (payment_id, concept_id, concept_kind, description, amount, withholding_id)
    VALUES (
      _payment.id, (v_item->>'concept_id')::uuid, v_item->>'concept_kind', v_item->>'description',
      v_amount, CASE WHEN v_key IS NULL THEN NULL ELSE (v_ids->>v_key)::uuid END
    );

    IF v_item->>'concept_kind' = 'deduction' THEN
      v_deductions := v_deductions + v_amount;
      IF v_key IS NOT NULL THEN v_item_wh_total := v_item_wh_total + v_amount; END IF;
    ELSE
      v_gross := v_gross + v_amount;
    END IF;
  END LOOP;

  IF round(v_wh_total, 2) <> round(v_item_wh_total, 2) THEN
    RAISE EXCEPTION 'INVALID_PAYMENT: las retenciones no cuadran con las líneas del pago';
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
REVOKE EXECUTE ON FUNCTION public.write_payroll_payment_lines(public.payroll_payments, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.write_payroll_payment_lines(public.payroll_payments, jsonb, jsonb, jsonb) TO authenticated, service_role;

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
    payment_method_id, payment_date, notes, created_by
  ) VALUES (
    v_school_id, (_payload->>'period_id')::uuid, v_beneficiary.id, v_kind, 'draft',
    coalesce(_payload->>'currency', 'VES'), coalesce((_payload->>'exchange_rate')::numeric, 1),
    (_payload->>'payment_method_id')::uuid, (_payload->>'payment_date')::date,
    _payload->>'notes', v_uid
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

  PERFORM public.write_payroll_payment_lines(v_payment, _payload->'items', _payload->'withholdings', v_docs);

  INSERT INTO public.payroll_audit_log (school_id, payment_id, action, actor_id, detail)
  VALUES (v_school_id, v_payment.id, 'created', v_uid, jsonb_build_object(
    'documents', jsonb_array_length(coalesce(_payload->'documents', '[]'::jsonb)),
    'withholdings', jsonb_array_length(coalesce(_payload->'withholdings', '[]'::jsonb)),
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

-- Replaces the calculated withholdings with fresh ones and sends the payment back to draft,
-- because the approved net may have changed.
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

  UPDATE public.payroll_payments
     SET status = 'draft', approved_by = NULL, approved_at = NULL
   WHERE id = _payment_id;

  PERFORM public.write_payroll_payment_lines(v_payment, _payload->'items', _payload->'withholdings', v_docs);

  INSERT INTO public.payroll_audit_log (school_id, payment_id, action, actor_id, detail)
  VALUES (v_payment.school_id, _payment_id, 'withholdings_recalculated', v_uid, '{}'::jsonb);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.recalculate_payroll_payment_withholdings(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalculate_payroll_payment_withholdings(uuid, jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mark_payroll_payment_paid(_payment_id uuid, _payment_date date DEFAULT NULL)
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

  v_date := coalesce(_payment_date, (now() AT TIME ZONE 'America/Caracas')::date);

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
    status = 'paid', paid_by = v_uid, paid_at = now(), payment_date = v_date, updated_at = now()
  WHERE id = _payment_id;

  INSERT INTO public.payroll_audit_log (school_id, payment_id, action, actor_id, detail)
  VALUES (v_payment.school_id, _payment_id, 'paid', v_uid, '{}'::jsonb);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.mark_payroll_payment_paid(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_payroll_payment_paid(uuid, date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.void_payroll_payment(_payment_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_payment public.payroll_payments;
BEGIN
  SELECT * INTO v_payment FROM public.payroll_payments WHERE id = _payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_PAYMENT: pago no encontrado';
  END IF;
  IF NOT public.payroll_can(v_payment.school_id, 'payroll.approve') THEN
    RAISE EXCEPTION 'NOT_ALLOWED: no tiene permiso para anular pagos de nómina';
  END IF;
  IF v_payment.status = 'voided' THEN
    RAISE EXCEPTION 'INVALID_PAYMENT: el pago ya está anulado';
  END IF;
  IF coalesce(btrim(_reason), '') = '' THEN
    RAISE EXCEPTION 'INVALID_PAYMENT: el motivo de la anulación es obligatorio';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.payroll_withholdings
     WHERE payment_id = _payment_id AND status IN ('declared','remitted')
  ) THEN
    RAISE EXCEPTION 'WITHHOLDING_DECLARED: este pago tiene retenciones ya declaradas y no se puede anular';
  END IF;

  -- The voucher number stays on the voided row, so it's never reused.
  UPDATE public.payroll_withholdings
     SET status = 'voided', voided_at = now(), voided_by = v_uid, void_reason = _reason
   WHERE payment_id = _payment_id AND status <> 'voided';

  UPDATE public.payroll_purchase_documents SET is_voided = true WHERE payment_id = _payment_id;

  UPDATE public.payroll_payments
     SET status = 'voided', voided_by = v_uid, voided_at = now(), void_reason = _reason, updated_at = now()
   WHERE id = _payment_id;

  INSERT INTO public.payroll_audit_log (school_id, payment_id, action, actor_id, detail)
  VALUES (v_payment.school_id, _payment_id, 'voided', v_uid, jsonb_build_object('reason', _reason));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.void_payroll_payment(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.void_payroll_payment(uuid, text) TO authenticated, service_role;

-- Marks issued withholdings as declared or remitted, with their date and reference.
CREATE OR REPLACE FUNCTION public.set_payroll_withholdings_status(
  _school_id uuid,
  _withholding_ids uuid[],
  _status text,
  _date date,
  _reference text
)
RETURNS integer
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer;
BEGIN
  IF NOT public.payroll_can(_school_id, 'payroll.withholdings') THEN
    RAISE EXCEPTION 'NOT_ALLOWED: no tiene permiso para gestionar retenciones';
  END IF;
  IF _status NOT IN ('declared','remitted') OR _date IS NULL THEN
    RAISE EXCEPTION 'INVALID_PAYMENT: estado o fecha no válidos';
  END IF;

  IF _status = 'declared' THEN
    UPDATE public.payroll_withholdings
       SET status = 'declared', declared_at = _date, declaration_ref = _reference
     WHERE school_id = _school_id AND id = ANY(_withholding_ids) AND status = 'issued';
  ELSE
    UPDATE public.payroll_withholdings
       SET status = 'remitted', remitted_at = _date, remittance_ref = _reference
     WHERE school_id = _school_id AND id = ANY(_withholding_ids) AND status = 'declared';
  END IF;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO public.payroll_audit_log (school_id, action, actor_id, detail)
  VALUES (_school_id, 'withholdings_' || _status, v_uid, jsonb_build_object(
    'count', v_count, 'date', _date, 'reference', _reference));

  RETURN v_count;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_payroll_withholdings_status(uuid, uuid[], text, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_payroll_withholdings_status(uuid, uuid[], text, date, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
