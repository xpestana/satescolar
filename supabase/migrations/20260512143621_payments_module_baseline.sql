CREATE TABLE IF NOT EXISTS public.bcv_rates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    currency text NOT NULL,
    rate_to_ves numeric NOT NULL,
    published_date date NOT NULL,
    fetched_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.delinquency_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    overdue_after_day integer DEFAULT 15 NOT NULL,
    reminder_mode text DEFAULT 'never'::text NOT NULL,
    reminder_days_of_week jsonb DEFAULT '[]'::jsonb,
    reminder_days_of_month jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.delinquency_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    student_id uuid NOT NULL,
    family_id uuid NOT NULL,
    email_sent_to text NOT NULL,
    concepts_detail jsonb DEFAULT '[]'::jsonb NOT NULL,
    total_owed_ves numeric DEFAULT 0 NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'sent'::text NOT NULL,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.exchange_rates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    currency text NOT NULL,
    rate_to_ves numeric DEFAULT 1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid
);
CREATE TABLE IF NOT EXISTS public.payment_concepts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text,
    default_amount numeric DEFAULT 0 NOT NULL,
    concept_type text DEFAULT 'otro'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.payment_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payment_id uuid NOT NULL,
    plan_concept_id uuid NOT NULL,
    amount_ves numeric DEFAULT 0 NOT NULL,
    is_partial boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.payment_method_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payment_id uuid NOT NULL,
    method text DEFAULT 'efectivo'::text NOT NULL,
    bank_name text DEFAULT ''::text,
    reference_code text DEFAULT ''::text,
    amount_original numeric DEFAULT 0 NOT NULL,
    currency text DEFAULT 'VES'::text NOT NULL,
    exchange_rate numeric DEFAULT 1 NOT NULL,
    amount_ves numeric DEFAULT 0 NOT NULL,
    payment_date date DEFAULT CURRENT_DATE NOT NULL,
    details text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.payment_plan_concepts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid NOT NULL,
    concept_id uuid NOT NULL,
    amount numeric DEFAULT 0 NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    is_mandatory boolean DEFAULT true NOT NULL,
    is_recurring boolean DEFAULT false NOT NULL,
    due_day integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.payment_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    student_id uuid NOT NULL,
    school_year_id uuid NOT NULL,
    payment_date date DEFAULT CURRENT_DATE NOT NULL,
    total_amount_ves numeric DEFAULT 0 NOT NULL,
    observations text DEFAULT ''::text,
    invoice_rif text DEFAULT ''::text,
    invoice_name text DEFAULT ''::text,
    invoice_address text DEFAULT ''::text,
    invoice_phone text DEFAULT ''::text,
    status text DEFAULT 'completed'::text NOT NULL,
    void_reason text,
    voided_by uuid,
    voided_at timestamp with time zone,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.school_payment_methods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    method_type text NOT NULL,
    label text NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.student_concept_balances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    student_id uuid NOT NULL,
    school_year_id uuid NOT NULL,
    plan_concept_id uuid NOT NULL,
    total_amount numeric DEFAULT 0 NOT NULL,
    paid_amount numeric DEFAULT 0 NOT NULL,
    balance numeric DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    last_payment_date timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.student_payment_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    student_id uuid NOT NULL,
    school_year_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public.bcv_rates
    ADD CONSTRAINT bcv_rates_currency_published_date_key UNIQUE (currency, published_date);
ALTER TABLE ONLY public.bcv_rates
    ADD CONSTRAINT bcv_rates_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.delinquency_config
    ADD CONSTRAINT delinquency_config_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.delinquency_config
    ADD CONSTRAINT delinquency_config_school_id_key UNIQUE (school_id);
ALTER TABLE ONLY public.delinquency_notifications
    ADD CONSTRAINT delinquency_notifications_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.exchange_rates
    ADD CONSTRAINT exchange_rates_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.exchange_rates
    ADD CONSTRAINT exchange_rates_school_id_currency_key UNIQUE (school_id, currency);
ALTER TABLE ONLY public.payment_concepts
    ADD CONSTRAINT payment_concepts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.payment_items
    ADD CONSTRAINT payment_items_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.payment_method_entries
    ADD CONSTRAINT payment_method_entries_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.payment_plan_concepts
    ADD CONSTRAINT payment_plan_concepts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.payment_plan_concepts
    ADD CONSTRAINT payment_plan_concepts_plan_id_concept_id_key UNIQUE (plan_id, concept_id);
ALTER TABLE ONLY public.payment_plans
    ADD CONSTRAINT payment_plans_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.school_payment_methods
    ADD CONSTRAINT school_payment_methods_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.student_concept_balances
    ADD CONSTRAINT student_concept_balances_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.student_concept_balances
    ADD CONSTRAINT student_concept_balances_student_id_school_year_id_plan_con_key UNIQUE (student_id, school_year_id, plan_concept_id);
ALTER TABLE ONLY public.student_payment_plans
    ADD CONSTRAINT student_payment_plans_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.student_payment_plans
    ADD CONSTRAINT student_payment_plans_student_id_school_year_id_key UNIQUE (student_id, school_year_id);
CREATE INDEX idx_delinquency_notifications_school ON public.delinquency_notifications USING btree (school_id, student_id);
CREATE INDEX idx_payment_concepts_school ON public.payment_concepts USING btree (school_id);
CREATE INDEX idx_payment_plans_school ON public.payment_plans USING btree (school_id);
CREATE INDEX idx_payments_school_student ON public.payments USING btree (school_id, student_id);
CREATE INDEX idx_payments_school_year ON public.payments USING btree (school_id, school_year_id);
CREATE INDEX idx_student_concept_balances_school_year ON public.student_concept_balances USING btree (school_id, school_year_id);
CREATE INDEX idx_student_concept_balances_status ON public.student_concept_balances USING btree (status);
CREATE INDEX idx_student_payment_plans_school_year ON public.student_payment_plans USING btree (school_id, school_year_id);
CREATE TRIGGER update_delinquency_config_updated_at BEFORE UPDATE ON public.delinquency_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payment_concepts_updated_at BEFORE UPDATE ON public.payment_concepts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payment_plans_updated_at BEFORE UPDATE ON public.payment_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_student_concept_balances_updated_at BEFORE UPDATE ON public.student_concept_balances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE ONLY public.delinquency_config
    ADD CONSTRAINT delinquency_config_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.delinquency_notifications
    ADD CONSTRAINT delinquency_notifications_family_id_fkey FOREIGN KEY (family_id) REFERENCES public.families(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.delinquency_notifications
    ADD CONSTRAINT delinquency_notifications_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.delinquency_notifications
    ADD CONSTRAINT delinquency_notifications_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.exchange_rates
    ADD CONSTRAINT exchange_rates_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.payment_concepts
    ADD CONSTRAINT payment_concepts_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.payment_items
    ADD CONSTRAINT payment_items_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.payment_items
    ADD CONSTRAINT payment_items_plan_concept_id_fkey FOREIGN KEY (plan_concept_id) REFERENCES public.payment_plan_concepts(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.payment_method_entries
    ADD CONSTRAINT payment_method_entries_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.payment_plan_concepts
    ADD CONSTRAINT payment_plan_concepts_concept_id_fkey FOREIGN KEY (concept_id) REFERENCES public.payment_concepts(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.payment_plan_concepts
    ADD CONSTRAINT payment_plan_concepts_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.payment_plans(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.payment_plans
    ADD CONSTRAINT payment_plans_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_school_year_id_fkey FOREIGN KEY (school_year_id) REFERENCES public.school_years(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.school_payment_methods
    ADD CONSTRAINT school_payment_methods_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.student_concept_balances
    ADD CONSTRAINT student_concept_balances_plan_concept_id_fkey FOREIGN KEY (plan_concept_id) REFERENCES public.payment_plan_concepts(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.student_concept_balances
    ADD CONSTRAINT student_concept_balances_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.student_concept_balances
    ADD CONSTRAINT student_concept_balances_school_year_id_fkey FOREIGN KEY (school_year_id) REFERENCES public.school_years(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.student_concept_balances
    ADD CONSTRAINT student_concept_balances_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.student_payment_plans
    ADD CONSTRAINT student_payment_plans_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.payment_plans(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.student_payment_plans
    ADD CONSTRAINT student_payment_plans_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.student_payment_plans
    ADD CONSTRAINT student_payment_plans_school_year_id_fkey FOREIGN KEY (school_year_id) REFERENCES public.school_years(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.student_payment_plans
    ADD CONSTRAINT student_payment_plans_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
CREATE POLICY "Admins can manage all delinquency_config" ON public.delinquency_config USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins can manage all delinquency_notifications" ON public.delinquency_notifications USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins can manage all exchange_rates" ON public.exchange_rates USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins can manage all payment_concepts" ON public.payment_concepts USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins can manage all payment_items" ON public.payment_items USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins can manage all payment_method_entries" ON public.payment_method_entries USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins can manage all payment_plan_concepts" ON public.payment_plan_concepts USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins can manage all payment_plans" ON public.payment_plans USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins can manage all payments" ON public.payments USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins can manage all school_payment_methods" ON public.school_payment_methods USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins can manage all student_concept_balances" ON public.student_concept_balances USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins can manage all student_payment_plans" ON public.student_payment_plans USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Authenticated users can read bcv_rates" ON public.bcv_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "School users can delete their payment_concepts" ON public.payment_concepts FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.school_id = payment_concepts.school_id)))));
CREATE POLICY "School users can delete their payment_plan_concepts" ON public.payment_plan_concepts FOR DELETE USING ((EXISTS ( SELECT 1
   FROM (public.user_roles ur
     JOIN public.payment_plans pp ON ((pp.id = payment_plan_concepts.plan_id)))
  WHERE ((ur.user_id = auth.uid()) AND (ur.school_id = pp.school_id)))));
CREATE POLICY "School users can delete their payment_plans" ON public.payment_plans FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.school_id = payment_plans.school_id)))));
CREATE POLICY "School users can delete their school_payment_methods" ON public.school_payment_methods FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.school_id = school_payment_methods.school_id)))));
CREATE POLICY "School users can delete their student_payment_plans" ON public.student_payment_plans FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.school_id = student_payment_plans.school_id)))));
CREATE POLICY "School users can insert their delinquency_config" ON public.delinquency_config FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.school_id = delinquency_config.school_id)))));
CREATE POLICY "School users can insert their delinquency_notifications" ON public.delinquency_notifications FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.school_id = delinquency_notifications.school_id)))));
CREATE POLICY "School users can insert their exchange_rates" ON public.exchange_rates FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.school_id = exchange_rates.school_id)))));
CREATE POLICY "School users can insert their payment_concepts" ON public.payment_concepts FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.school_id = payment_concepts.school_id)))));
CREATE POLICY "School users can insert their payment_items" ON public.payment_items FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.user_roles ur
     JOIN public.payments p ON ((p.id = payment_items.payment_id)))
  WHERE ((ur.user_id = auth.uid()) AND (ur.school_id = p.school_id)))));
CREATE POLICY "School users can insert their payment_method_entries" ON public.payment_method_entries FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.user_roles ur
     JOIN public.payments p ON ((p.id = payment_method_entries.payment_id)))
  WHERE ((ur.user_id = auth.uid()) AND (ur.school_id = p.school_id)))));
CREATE POLICY "School users can insert their payment_plan_concepts" ON public.payment_plan_concepts FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.user_roles ur
     JOIN public.payment_plans pp ON ((pp.id = payment_plan_concepts.plan_id)))
  WHERE ((ur.user_id = auth.uid()) AND (ur.school_id = pp.school_id)))));
CREATE POLICY "School users can insert their payment_plans" ON public.payment_plans FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.school_id = payment_plans.school_id)))));
CREATE POLICY "School users can insert their payments" ON public.payments FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.school_id = payments.school_id)))));
CREATE POLICY "School users can insert their school_payment_methods" ON public.school_payment_methods FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.school_id = school_payment_methods.school_id)))));
CREATE POLICY "School users can insert their student_concept_balances" ON public.student_concept_balances FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.school_id = student_concept_balances.school_id)))));
CREATE POLICY "School users can insert their student_payment_plans" ON public.student_payment_plans FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.school_id = student_payment_plans.school_id)))));
CREATE POLICY "School users can update their delinquency_config" ON public.delinquency_config FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.school_id = delinquency_config.school_id)))));
CREATE POLICY "School users can update their exchange_rates" ON public.exchange_rates FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.school_id = exchange_rates.school_id)))));
CREATE POLICY "School users can update their payment_concepts" ON public.payment_concepts FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.school_id = payment_concepts.school_id)))));
CREATE POLICY "School users can update their payment_plan_concepts" ON public.payment_plan_concepts FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM (public.user_roles ur
     JOIN public.payment_plans pp ON ((pp.id = payment_plan_concepts.plan_id)))
  WHERE ((ur.user_id = auth.uid()) AND (ur.school_id = pp.school_id)))));
CREATE POLICY "School users can update their payment_plans" ON public.payment_plans FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.school_id = payment_plans.school_id)))));
CREATE POLICY "School users can update their payments" ON public.payments FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.school_id = payments.school_id)))));
CREATE POLICY "School users can update their school_payment_methods" ON public.school_payment_methods FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.school_id = school_payment_methods.school_id)))));
CREATE POLICY "School users can update their student_concept_balances" ON public.student_concept_balances FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.school_id = student_concept_balances.school_id)))));
CREATE POLICY "School users can update their student_payment_plans" ON public.student_payment_plans FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.school_id = student_payment_plans.school_id)))));
CREATE POLICY "School users can view their delinquency_config" ON public.delinquency_config FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.school_id = delinquency_config.school_id)))));
CREATE POLICY "School users can view their delinquency_notifications" ON public.delinquency_notifications FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.school_id = delinquency_notifications.school_id)))));
CREATE POLICY "School users can view their exchange_rates" ON public.exchange_rates FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.school_id = exchange_rates.school_id)))));
CREATE POLICY "School users can view their payment_concepts" ON public.payment_concepts FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.school_id = payment_concepts.school_id)))));
CREATE POLICY "School users can view their payment_items" ON public.payment_items FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.user_roles ur
     JOIN public.payments p ON ((p.id = payment_items.payment_id)))
  WHERE ((ur.user_id = auth.uid()) AND (ur.school_id = p.school_id)))));
CREATE POLICY "School users can view their payment_method_entries" ON public.payment_method_entries FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.user_roles ur
     JOIN public.payments p ON ((p.id = payment_method_entries.payment_id)))
  WHERE ((ur.user_id = auth.uid()) AND (ur.school_id = p.school_id)))));
CREATE POLICY "School users can view their payment_plan_concepts" ON public.payment_plan_concepts FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.user_roles ur
     JOIN public.payment_plans pp ON ((pp.id = payment_plan_concepts.plan_id)))
  WHERE ((ur.user_id = auth.uid()) AND (ur.school_id = pp.school_id)))));
CREATE POLICY "School users can view their payment_plans" ON public.payment_plans FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.school_id = payment_plans.school_id)))));
CREATE POLICY "School users can view their payments" ON public.payments FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.school_id = payments.school_id)))));
CREATE POLICY "School users can view their school_payment_methods" ON public.school_payment_methods FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.school_id = school_payment_methods.school_id)))));
CREATE POLICY "School users can view their student_concept_balances" ON public.student_concept_balances FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.school_id = student_concept_balances.school_id)))));
CREATE POLICY "School users can view their student_payment_plans" ON public.student_payment_plans FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.school_id = student_payment_plans.school_id)))));
ALTER TABLE public.bcv_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delinquency_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delinquency_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_method_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_plan_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_concept_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_payment_plans ENABLE ROW LEVEL SECURITY;
