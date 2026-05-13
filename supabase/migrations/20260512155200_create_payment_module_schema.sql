-- Base schema for the payments module. Later migrations add constraints,
-- cleanup logic, due dates and delinquency helpers on top of these tables.

CREATE TABLE IF NOT EXISTS public.exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  currency text NOT NULL,
  rate_to_ves numeric NOT NULL DEFAULT 1,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exchange_rates_currency_check CHECK (currency IN ('VES','USD','EUR','COP')),
  CONSTRAINT exchange_rates_school_currency_key UNIQUE (school_id, currency)
);

CREATE TABLE IF NOT EXISTS public.payment_concepts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  concept_type text NOT NULL DEFAULT 'mensualidad',
  default_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'VES',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_concepts_currency_check CHECK (currency IN ('VES','USD','EUR','COP')),
  CONSTRAINT payment_concepts_default_amount_check CHECK (default_amount >= 0)
);

CREATE TABLE IF NOT EXISTS public.payment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_plan_concepts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.payment_plans(id) ON DELETE CASCADE,
  concept_id uuid NOT NULL REFERENCES public.payment_concepts(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  currency text,
  display_order integer NOT NULL DEFAULT 0,
  is_mandatory boolean NOT NULL DEFAULT true,
  is_recurring boolean NOT NULL DEFAULT false,
  due_day smallint,
  due_month smallint,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_plan_concepts_amount_check CHECK (amount >= 0),
  CONSTRAINT payment_plan_concepts_currency_check CHECK (currency IS NULL OR currency IN ('VES','USD','EUR','COP')),
  CONSTRAINT payment_plan_concepts_due_day_check CHECK (due_day IS NULL OR (due_day BETWEEN 1 AND 31)),
  CONSTRAINT payment_plan_concepts_due_month_check CHECK (due_month IS NULL OR (due_month BETWEEN 1 AND 12)),
  CONSTRAINT payment_plan_concepts_unique_plan_concept UNIQUE (plan_id, concept_id)
);

CREATE TABLE IF NOT EXISTS public.student_payment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.payment_plans(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  school_year_id uuid NOT NULL REFERENCES public.school_years(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_payment_plans_unique_student_school_year UNIQUE (student_id, school_id, school_year_id)
);

CREATE TABLE IF NOT EXISTS public.student_concept_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  school_year_id uuid NOT NULL REFERENCES public.school_years(id) ON DELETE CASCADE,
  plan_concept_id uuid NOT NULL REFERENCES public.payment_plan_concepts(id) ON DELETE CASCADE,
  currency text NOT NULL DEFAULT 'VES',
  original_amount numeric,
  exchange_rate_snapshot numeric NOT NULL DEFAULT 1,
  total_amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  balance numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  last_payment_date timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_concept_balances_currency_check CHECK (currency IN ('VES','USD','EUR','COP')),
  CONSTRAINT student_concept_balances_amounts_check CHECK (total_amount >= 0 AND paid_amount >= 0 AND balance >= 0),
  CONSTRAINT student_concept_balances_status_check CHECK (status IN ('pending','partial','paid','voided')),
  CONSTRAINT student_concept_balances_unique_student_year_concept UNIQUE (student_id, school_year_id, plan_concept_id)
);

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  school_year_id uuid NOT NULL REFERENCES public.school_years(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  total_amount_ves numeric NOT NULL DEFAULT 0,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'paid',
  observations text,
  invoice_name text,
  invoice_rif text,
  invoice_phone text,
  invoice_address text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  void_reason text,
  voided_at timestamptz,
  voided_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_total_amount_check CHECK (total_amount_ves >= 0),
  CONSTRAINT payments_status_check CHECK (status IN ('paid','voided'))
);

CREATE TABLE IF NOT EXISTS public.payment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  plan_concept_id uuid NOT NULL REFERENCES public.payment_plan_concepts(id) ON DELETE CASCADE,
  amount_ves numeric NOT NULL DEFAULT 0,
  is_partial boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_items_amount_check CHECK (amount_ves >= 0)
);

CREATE TABLE IF NOT EXISTS public.payment_method_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  method text NOT NULL DEFAULT 'transferencia',
  currency text NOT NULL DEFAULT 'VES',
  amount_original numeric NOT NULL DEFAULT 0,
  exchange_rate numeric NOT NULL DEFAULT 1,
  amount_ves numeric NOT NULL DEFAULT 0,
  reference_code text,
  bank_name text,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  details text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_method_entries_currency_check CHECK (currency IN ('VES','USD','EUR','COP')),
  CONSTRAINT payment_method_entries_amounts_check CHECK (amount_original >= 0 AND exchange_rate >= 0 AND amount_ves >= 0)
);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_school_id ON public.exchange_rates(school_id);
CREATE INDEX IF NOT EXISTS idx_payment_concepts_school_id ON public.payment_concepts(school_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_school_id ON public.payment_plans(school_id);
CREATE INDEX IF NOT EXISTS idx_payment_plan_concepts_plan_id ON public.payment_plan_concepts(plan_id);
CREATE INDEX IF NOT EXISTS idx_payment_plan_concepts_concept_id ON public.payment_plan_concepts(concept_id);
CREATE INDEX IF NOT EXISTS idx_student_payment_plans_student_year ON public.student_payment_plans(student_id, school_year_id);
CREATE INDEX IF NOT EXISTS idx_student_concept_balances_student_year ON public.student_concept_balances(student_id, school_year_id);
CREATE INDEX IF NOT EXISTS idx_student_concept_balances_plan_concept_id ON public.student_concept_balances(plan_concept_id);
CREATE INDEX IF NOT EXISTS idx_payments_school_year_student ON public.payments(school_id, school_year_id, student_id);
CREATE INDEX IF NOT EXISTS idx_payment_items_payment_id ON public.payment_items(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_method_entries_payment_id ON public.payment_method_entries(payment_id);

ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_plan_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_concept_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_method_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage all exchange_rates" ON public.exchange_rates;
CREATE POLICY "Admins can manage all exchange_rates"
ON public.exchange_rates FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "School users can manage their exchange_rates" ON public.exchange_rates;
CREATE POLICY "School users can manage their exchange_rates"
ON public.exchange_rates FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_roles.user_id = auth.uid()
    AND user_roles.school_id = exchange_rates.school_id
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_roles.user_id = auth.uid()
    AND user_roles.school_id = exchange_rates.school_id
));

DROP POLICY IF EXISTS "Admins can manage all payment_concepts" ON public.payment_concepts;
CREATE POLICY "Admins can manage all payment_concepts"
ON public.payment_concepts FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "School users can manage their payment_concepts" ON public.payment_concepts;
CREATE POLICY "School users can manage their payment_concepts"
ON public.payment_concepts FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_roles.user_id = auth.uid()
    AND user_roles.school_id = payment_concepts.school_id
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_roles.user_id = auth.uid()
    AND user_roles.school_id = payment_concepts.school_id
));

DROP POLICY IF EXISTS "Admins can manage all payment_plans" ON public.payment_plans;
CREATE POLICY "Admins can manage all payment_plans"
ON public.payment_plans FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "School users can manage their payment_plans" ON public.payment_plans;
CREATE POLICY "School users can manage their payment_plans"
ON public.payment_plans FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_roles.user_id = auth.uid()
    AND user_roles.school_id = payment_plans.school_id
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_roles.user_id = auth.uid()
    AND user_roles.school_id = payment_plans.school_id
));

DROP POLICY IF EXISTS "Admins can manage all payment_plan_concepts" ON public.payment_plan_concepts;
CREATE POLICY "Admins can manage all payment_plan_concepts"
ON public.payment_plan_concepts FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "School users can manage their payment_plan_concepts" ON public.payment_plan_concepts;
CREATE POLICY "School users can manage their payment_plan_concepts"
ON public.payment_plan_concepts FOR ALL
USING (EXISTS (
  SELECT 1
  FROM public.payment_plans pp
  JOIN public.user_roles ur ON ur.school_id = pp.school_id
  WHERE pp.id = payment_plan_concepts.plan_id
    AND ur.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1
  FROM public.payment_plans pp
  JOIN public.user_roles ur ON ur.school_id = pp.school_id
  WHERE pp.id = payment_plan_concepts.plan_id
    AND ur.user_id = auth.uid()
));

DROP POLICY IF EXISTS "Admins can manage all student_payment_plans" ON public.student_payment_plans;
CREATE POLICY "Admins can manage all student_payment_plans"
ON public.student_payment_plans FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "School users can manage their student_payment_plans" ON public.student_payment_plans;
CREATE POLICY "School users can manage their student_payment_plans"
ON public.student_payment_plans FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_roles.user_id = auth.uid()
    AND user_roles.school_id = student_payment_plans.school_id
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_roles.user_id = auth.uid()
    AND user_roles.school_id = student_payment_plans.school_id
));

DROP POLICY IF EXISTS "Admins can manage all student_concept_balances" ON public.student_concept_balances;
CREATE POLICY "Admins can manage all student_concept_balances"
ON public.student_concept_balances FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "School users can manage their student_concept_balances" ON public.student_concept_balances;
CREATE POLICY "School users can manage their student_concept_balances"
ON public.student_concept_balances FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_roles.user_id = auth.uid()
    AND user_roles.school_id = student_concept_balances.school_id
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_roles.user_id = auth.uid()
    AND user_roles.school_id = student_concept_balances.school_id
));

DROP POLICY IF EXISTS "Admins can manage all payments" ON public.payments;
CREATE POLICY "Admins can manage all payments"
ON public.payments FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "School users can manage their payments" ON public.payments;
CREATE POLICY "School users can manage their payments"
ON public.payments FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_roles.user_id = auth.uid()
    AND user_roles.school_id = payments.school_id
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_roles.user_id = auth.uid()
    AND user_roles.school_id = payments.school_id
));

DROP POLICY IF EXISTS "Admins can manage all payment_items" ON public.payment_items;
CREATE POLICY "Admins can manage all payment_items"
ON public.payment_items FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "School users can manage their payment_items" ON public.payment_items;
CREATE POLICY "School users can manage their payment_items"
ON public.payment_items FOR ALL
USING (EXISTS (
  SELECT 1
  FROM public.payments p
  JOIN public.user_roles ur ON ur.school_id = p.school_id
  WHERE p.id = payment_items.payment_id
    AND ur.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1
  FROM public.payments p
  JOIN public.user_roles ur ON ur.school_id = p.school_id
  WHERE p.id = payment_items.payment_id
    AND ur.user_id = auth.uid()
));

DROP POLICY IF EXISTS "Admins can manage all payment_method_entries" ON public.payment_method_entries;
CREATE POLICY "Admins can manage all payment_method_entries"
ON public.payment_method_entries FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "School users can manage their payment_method_entries" ON public.payment_method_entries;
CREATE POLICY "School users can manage their payment_method_entries"
ON public.payment_method_entries FOR ALL
USING (EXISTS (
  SELECT 1
  FROM public.payments p
  JOIN public.user_roles ur ON ur.school_id = p.school_id
  WHERE p.id = payment_method_entries.payment_id
    AND ur.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1
  FROM public.payments p
  JOIN public.user_roles ur ON ur.school_id = p.school_id
  WHERE p.id = payment_method_entries.payment_id
    AND ur.user_id = auth.uid()
));

NOTIFY pgrst, 'reload schema';
