
-- 1. payment_concepts
CREATE TABLE public.payment_concepts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  default_amount numeric NOT NULL DEFAULT 0,
  concept_type text NOT NULL DEFAULT 'otro',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_concepts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage all payment_concepts" ON public.payment_concepts FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "School users can view their payment_concepts" ON public.payment_concepts FOR SELECT TO public USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = payment_concepts.school_id));
CREATE POLICY "School users can insert their payment_concepts" ON public.payment_concepts FOR INSERT TO public WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = payment_concepts.school_id));
CREATE POLICY "School users can update their payment_concepts" ON public.payment_concepts FOR UPDATE TO public USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = payment_concepts.school_id));
CREATE POLICY "School users can delete their payment_concepts" ON public.payment_concepts FOR DELETE TO public USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = payment_concepts.school_id));
CREATE TRIGGER update_payment_concepts_updated_at BEFORE UPDATE ON public.payment_concepts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. payment_plans
CREATE TABLE public.payment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage all payment_plans" ON public.payment_plans FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "School users can view their payment_plans" ON public.payment_plans FOR SELECT TO public USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = payment_plans.school_id));
CREATE POLICY "School users can insert their payment_plans" ON public.payment_plans FOR INSERT TO public WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = payment_plans.school_id));
CREATE POLICY "School users can update their payment_plans" ON public.payment_plans FOR UPDATE TO public USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = payment_plans.school_id));
CREATE POLICY "School users can delete their payment_plans" ON public.payment_plans FOR DELETE TO public USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = payment_plans.school_id));
CREATE TRIGGER update_payment_plans_updated_at BEFORE UPDATE ON public.payment_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. payment_plan_concepts
CREATE TABLE public.payment_plan_concepts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.payment_plans(id) ON DELETE CASCADE,
  concept_id uuid NOT NULL REFERENCES public.payment_concepts(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  display_order integer NOT NULL DEFAULT 0,
  is_mandatory boolean NOT NULL DEFAULT true,
  is_recurring boolean NOT NULL DEFAULT false,
  due_day integer DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(plan_id, concept_id)
);
ALTER TABLE public.payment_plan_concepts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage all payment_plan_concepts" ON public.payment_plan_concepts FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "School users can view their payment_plan_concepts" ON public.payment_plan_concepts FOR SELECT TO public USING (EXISTS (SELECT 1 FROM user_roles ur JOIN payment_plans pp ON pp.id = payment_plan_concepts.plan_id WHERE ur.user_id = auth.uid() AND ur.school_id = pp.school_id));
CREATE POLICY "School users can insert their payment_plan_concepts" ON public.payment_plan_concepts FOR INSERT TO public WITH CHECK (EXISTS (SELECT 1 FROM user_roles ur JOIN payment_plans pp ON pp.id = payment_plan_concepts.plan_id WHERE ur.user_id = auth.uid() AND ur.school_id = pp.school_id));
CREATE POLICY "School users can update their payment_plan_concepts" ON public.payment_plan_concepts FOR UPDATE TO public USING (EXISTS (SELECT 1 FROM user_roles ur JOIN payment_plans pp ON pp.id = payment_plan_concepts.plan_id WHERE ur.user_id = auth.uid() AND ur.school_id = pp.school_id));
CREATE POLICY "School users can delete their payment_plan_concepts" ON public.payment_plan_concepts FOR DELETE TO public USING (EXISTS (SELECT 1 FROM user_roles ur JOIN payment_plans pp ON pp.id = payment_plan_concepts.plan_id WHERE ur.user_id = auth.uid() AND ur.school_id = pp.school_id));

-- 4. student_payment_plans
CREATE TABLE public.student_payment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_year_id uuid NOT NULL REFERENCES public.school_years(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.payment_plans(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, school_year_id)
);
ALTER TABLE public.student_payment_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage all student_payment_plans" ON public.student_payment_plans FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "School users can view their student_payment_plans" ON public.student_payment_plans FOR SELECT TO public USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = student_payment_plans.school_id));
CREATE POLICY "School users can insert their student_payment_plans" ON public.student_payment_plans FOR INSERT TO public WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = student_payment_plans.school_id));
CREATE POLICY "School users can update their student_payment_plans" ON public.student_payment_plans FOR UPDATE TO public USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = student_payment_plans.school_id));
CREATE POLICY "School users can delete their student_payment_plans" ON public.student_payment_plans FOR DELETE TO public USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = student_payment_plans.school_id));

-- 5. exchange_rates
CREATE TABLE public.exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  currency text NOT NULL,
  rate_to_ves numeric NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT NULL,
  UNIQUE(school_id, currency)
);
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage all exchange_rates" ON public.exchange_rates FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "School users can view their exchange_rates" ON public.exchange_rates FOR SELECT TO public USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = exchange_rates.school_id));
CREATE POLICY "School users can insert their exchange_rates" ON public.exchange_rates FOR INSERT TO public WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = exchange_rates.school_id));
CREATE POLICY "School users can update their exchange_rates" ON public.exchange_rates FOR UPDATE TO public USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = exchange_rates.school_id));

-- 6. payments
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_year_id uuid NOT NULL REFERENCES public.school_years(id) ON DELETE CASCADE,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  total_amount_ves numeric NOT NULL DEFAULT 0,
  observations text DEFAULT '',
  invoice_rif text DEFAULT '',
  invoice_name text DEFAULT '',
  invoice_address text DEFAULT '',
  invoice_phone text DEFAULT '',
  status text NOT NULL DEFAULT 'completed',
  void_reason text DEFAULT NULL,
  voided_by uuid DEFAULT NULL,
  voided_at timestamptz DEFAULT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage all payments" ON public.payments FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "School users can view their payments" ON public.payments FOR SELECT TO public USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = payments.school_id));
CREATE POLICY "School users can insert their payments" ON public.payments FOR INSERT TO public WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = payments.school_id));
CREATE POLICY "School users can update their payments" ON public.payments FOR UPDATE TO public USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = payments.school_id));
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. payment_items
CREATE TABLE public.payment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  plan_concept_id uuid NOT NULL REFERENCES public.payment_plan_concepts(id) ON DELETE CASCADE,
  amount_ves numeric NOT NULL DEFAULT 0,
  is_partial boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage all payment_items" ON public.payment_items FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "School users can view their payment_items" ON public.payment_items FOR SELECT TO public USING (EXISTS (SELECT 1 FROM user_roles ur JOIN payments p ON p.id = payment_items.payment_id WHERE ur.user_id = auth.uid() AND ur.school_id = p.school_id));
CREATE POLICY "School users can insert their payment_items" ON public.payment_items FOR INSERT TO public WITH CHECK (EXISTS (SELECT 1 FROM user_roles ur JOIN payments p ON p.id = payment_items.payment_id WHERE ur.user_id = auth.uid() AND ur.school_id = p.school_id));

-- 8. payment_method_entries
CREATE TABLE public.payment_method_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  method text NOT NULL DEFAULT 'efectivo',
  bank_name text DEFAULT '',
  reference_code text DEFAULT '',
  amount_original numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'VES',
  exchange_rate numeric NOT NULL DEFAULT 1,
  amount_ves numeric NOT NULL DEFAULT 0,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  details text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_method_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage all payment_method_entries" ON public.payment_method_entries FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "School users can view their payment_method_entries" ON public.payment_method_entries FOR SELECT TO public USING (EXISTS (SELECT 1 FROM user_roles ur JOIN payments p ON p.id = payment_method_entries.payment_id WHERE ur.user_id = auth.uid() AND ur.school_id = p.school_id));
CREATE POLICY "School users can insert their payment_method_entries" ON public.payment_method_entries FOR INSERT TO public WITH CHECK (EXISTS (SELECT 1 FROM user_roles ur JOIN payments p ON p.id = payment_method_entries.payment_id WHERE ur.user_id = auth.uid() AND ur.school_id = p.school_id));

-- 9. student_concept_balances
CREATE TABLE public.student_concept_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_year_id uuid NOT NULL REFERENCES public.school_years(id) ON DELETE CASCADE,
  plan_concept_id uuid NOT NULL REFERENCES public.payment_plan_concepts(id) ON DELETE CASCADE,
  total_amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  balance numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  last_payment_date timestamptz DEFAULT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, school_year_id, plan_concept_id)
);
ALTER TABLE public.student_concept_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage all student_concept_balances" ON public.student_concept_balances FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "School users can view their student_concept_balances" ON public.student_concept_balances FOR SELECT TO public USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = student_concept_balances.school_id));
CREATE POLICY "School users can insert their student_concept_balances" ON public.student_concept_balances FOR INSERT TO public WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = student_concept_balances.school_id));
CREATE POLICY "School users can update their student_concept_balances" ON public.student_concept_balances FOR UPDATE TO public USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = student_concept_balances.school_id));
CREATE TRIGGER update_student_concept_balances_updated_at BEFORE UPDATE ON public.student_concept_balances FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 10. delinquency_config
CREATE TABLE public.delinquency_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE UNIQUE,
  overdue_after_day integer NOT NULL DEFAULT 15,
  reminder_mode text NOT NULL DEFAULT 'never',
  reminder_days_of_week jsonb DEFAULT '[]'::jsonb,
  reminder_days_of_month jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.delinquency_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage all delinquency_config" ON public.delinquency_config FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "School users can view their delinquency_config" ON public.delinquency_config FOR SELECT TO public USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = delinquency_config.school_id));
CREATE POLICY "School users can insert their delinquency_config" ON public.delinquency_config FOR INSERT TO public WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = delinquency_config.school_id));
CREATE POLICY "School users can update their delinquency_config" ON public.delinquency_config FOR UPDATE TO public USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = delinquency_config.school_id));
CREATE TRIGGER update_delinquency_config_updated_at BEFORE UPDATE ON public.delinquency_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 11. delinquency_notifications
CREATE TABLE public.delinquency_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  email_sent_to text NOT NULL,
  concepts_detail jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_owed_ves numeric NOT NULL DEFAULT 0,
  sent_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'sent',
  error_message text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.delinquency_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage all delinquency_notifications" ON public.delinquency_notifications FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "School users can view their delinquency_notifications" ON public.delinquency_notifications FOR SELECT TO public USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = delinquency_notifications.school_id));
CREATE POLICY "School users can insert their delinquency_notifications" ON public.delinquency_notifications FOR INSERT TO public WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = delinquency_notifications.school_id));

-- Indexes for performance
CREATE INDEX idx_payment_concepts_school ON public.payment_concepts(school_id);
CREATE INDEX idx_payment_plans_school ON public.payment_plans(school_id);
CREATE INDEX idx_student_payment_plans_school_year ON public.student_payment_plans(school_id, school_year_id);
CREATE INDEX idx_payments_school_student ON public.payments(school_id, student_id);
CREATE INDEX idx_payments_school_year ON public.payments(school_id, school_year_id);
CREATE INDEX idx_student_concept_balances_school_year ON public.student_concept_balances(school_id, school_year_id);
CREATE INDEX idx_student_concept_balances_status ON public.student_concept_balances(status);
CREATE INDEX idx_delinquency_notifications_school ON public.delinquency_notifications(school_id, student_id);
