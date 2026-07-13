-- Payroll module schema (Pagos de Nóminas).
-- Beneficiaries reuse the existing `teachers` table for the "teacher" category and
-- store name + document for the rest. Money is handled in VES with an exchange rate
-- per payment (multi-currency Bs/USD), reusing the bcv_rates infrastructure.
-- RLS follows the payments module pattern: admins manage all, school users are scoped
-- by their school_id via user_roles. Function segregation (register vs approve) is
-- enforced at the UI/Edge-Function layer via permission keys.

-- ── 1. Tables ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payroll_beneficiaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'other',
  teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  document_id text,
  email text,
  phone text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payroll_beneficiaries_category_check
    CHECK (category IN ('teacher','admin','worker','other'))
);

-- Dedupe by document within a school (only when a document is present).
CREATE UNIQUE INDEX IF NOT EXISTS payroll_beneficiaries_school_document_uq
  ON public.payroll_beneficiaries(school_id, document_id)
  WHERE document_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.payroll_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  beneficiary_id uuid NOT NULL REFERENCES public.payroll_beneficiaries(id) ON DELETE CASCADE,
  method_type text NOT NULL DEFAULT 'transfer',
  label text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payroll_payment_methods_type_check
    CHECK (method_type IN ('transfer','mobile_payment','cash','check'))
);

CREATE TABLE IF NOT EXISTS public.payroll_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  period_type text NOT NULL DEFAULT 'monthly',
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'open',
  school_year_id uuid REFERENCES public.school_years(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payroll_periods_type_check CHECK (period_type IN ('biweekly','monthly')),
  CONSTRAINT payroll_periods_status_check CHECK (status IN ('open','closed')),
  CONSTRAINT payroll_periods_dates_check CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS public.payroll_concepts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  concept_kind text NOT NULL DEFAULT 'earning',
  default_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'VES',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payroll_concepts_kind_check CHECK (concept_kind IN ('earning','deduction')),
  CONSTRAINT payroll_concepts_currency_check CHECK (currency IN ('VES','USD')),
  CONSTRAINT payroll_concepts_amount_check CHECK (default_amount >= 0)
);

CREATE TABLE IF NOT EXISTS public.payroll_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  period_id uuid NOT NULL REFERENCES public.payroll_periods(id) ON DELETE RESTRICT,
  beneficiary_id uuid NOT NULL REFERENCES public.payroll_beneficiaries(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft',
  currency text NOT NULL DEFAULT 'VES',
  exchange_rate numeric NOT NULL DEFAULT 1,
  gross_amount numeric NOT NULL DEFAULT 0,
  deductions_amount numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL DEFAULT 0,
  net_amount_ves numeric NOT NULL DEFAULT 0,
  payment_method_id uuid REFERENCES public.payroll_payment_methods(id) ON DELETE SET NULL,
  payment_date date,
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  paid_by uuid REFERENCES auth.users(id),
  paid_at timestamptz,
  voided_by uuid REFERENCES auth.users(id),
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payroll_payments_status_check
    CHECK (status IN ('draft','approved','paid','voided')),
  CONSTRAINT payroll_payments_currency_check CHECK (currency IN ('VES','USD')),
  CONSTRAINT payroll_payments_amounts_check CHECK (
    exchange_rate >= 0 AND gross_amount >= 0 AND deductions_amount >= 0
    AND net_amount >= 0 AND net_amount_ves >= 0
  )
);

-- A beneficiary may only have one live payment per period (voided ones don't count).
CREATE UNIQUE INDEX IF NOT EXISTS payroll_payments_period_beneficiary_uq
  ON public.payroll_payments(period_id, beneficiary_id)
  WHERE status <> 'voided';

CREATE TABLE IF NOT EXISTS public.payroll_payment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payroll_payments(id) ON DELETE CASCADE,
  concept_id uuid REFERENCES public.payroll_concepts(id) ON DELETE SET NULL,
  concept_kind text NOT NULL DEFAULT 'earning',
  description text,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payroll_payment_items_kind_check CHECK (concept_kind IN ('earning','deduction')),
  CONSTRAINT payroll_payment_items_amount_check CHECK (amount >= 0)
);

CREATE TABLE IF NOT EXISTS public.payroll_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  payment_id uuid REFERENCES public.payroll_payments(id) ON DELETE SET NULL,
  action text NOT NULL,
  actor_id uuid REFERENCES auth.users(id),
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_payroll_beneficiaries_school ON public.payroll_beneficiaries(school_id);
CREATE INDEX IF NOT EXISTS idx_payroll_beneficiaries_school_category ON public.payroll_beneficiaries(school_id, category);
CREATE INDEX IF NOT EXISTS idx_payroll_beneficiaries_teacher ON public.payroll_beneficiaries(teacher_id);
CREATE INDEX IF NOT EXISTS idx_payroll_methods_beneficiary ON public.payroll_payment_methods(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_payroll_methods_school ON public.payroll_payment_methods(school_id);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_school ON public.payroll_periods(school_id);
CREATE INDEX IF NOT EXISTS idx_payroll_concepts_school ON public.payroll_concepts(school_id);
CREATE INDEX IF NOT EXISTS idx_payroll_payments_school_period ON public.payroll_payments(school_id, period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_payments_beneficiary ON public.payroll_payments(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_payroll_payments_school_status ON public.payroll_payments(school_id, status);
CREATE INDEX IF NOT EXISTS idx_payroll_items_payment ON public.payroll_payment_items(payment_id);
CREATE INDEX IF NOT EXISTS idx_payroll_audit_school_payment ON public.payroll_audit_log(school_id, payment_id);

-- ── 3. Row Level Security ────────────────────────────────────────────────────

ALTER TABLE public.payroll_beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_payment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_audit_log ENABLE ROW LEVEL SECURITY;

-- Helper: school-scoped tables (direct school_id column).
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'payroll_beneficiaries','payroll_payment_methods','payroll_periods',
    'payroll_concepts','payroll_payments','payroll_audit_log'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Admins manage all %1$s" ON public.%1$s;', t);
    EXECUTE format(
      'CREATE POLICY "Admins manage all %1$s" ON public.%1$s FOR ALL '
      'USING (public.is_admin()) WITH CHECK (public.is_admin());', t);

    EXECUTE format('DROP POLICY IF EXISTS "School users manage their %1$s" ON public.%1$s;', t);
    EXECUTE format(
      'CREATE POLICY "School users manage their %1$s" ON public.%1$s FOR ALL '
      'USING (EXISTS (SELECT 1 FROM public.user_roles ur '
      '  WHERE ur.user_id = auth.uid() AND ur.school_id = %1$s.school_id)) '
      'WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur '
      '  WHERE ur.user_id = auth.uid() AND ur.school_id = %1$s.school_id));', t);
  END LOOP;
END $$;

-- payroll_payment_items has no school_id: scope through its parent payment.
DROP POLICY IF EXISTS "Admins manage all payroll_payment_items" ON public.payroll_payment_items;
CREATE POLICY "Admins manage all payroll_payment_items"
ON public.payroll_payment_items FOR ALL
USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "School users manage their payroll_payment_items" ON public.payroll_payment_items;
CREATE POLICY "School users manage their payroll_payment_items"
ON public.payroll_payment_items FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.payroll_payments p
  JOIN public.user_roles ur ON ur.school_id = p.school_id
  WHERE p.id = payroll_payment_items.payment_id AND ur.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.payroll_payments p
  JOIN public.user_roles ur ON ur.school_id = p.school_id
  WHERE p.id = payroll_payment_items.payment_id AND ur.user_id = auth.uid()
));

-- ── 4. Permission keys (module "Pagos", after payments.* at 70-73) ───────────

INSERT INTO public.permission_keys (key, module, label, supports_scope, display_order) VALUES
  ('payroll.view','Pagos','Ver nómina y dashboard',false,74),
  ('payroll.register','Pagos','Registrar pagos de nómina',false,75),
  ('payroll.approve','Pagos','Aprobar y pagar nómina',false,76),
  ('payroll.config','Pagos','Configurar nómina (conceptos y períodos)',false,77)
ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
