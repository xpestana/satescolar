-- Rendimiento del módulo de pagos: el Reporte de Pagos daba "canceling statement due to
-- statement timeout" (57014) al consultar un año con ~400 facturas.
--
-- Causa medida con EXPLAIN (ANALYZE, BUFFERS) como rol `authenticated`: las políticas RLS
-- llaman `auth.uid()` / `is_admin()` **por fila**, y el reporte encadena tablas
-- (payments → payment_items → payment_plan_concepts → payment_plans/payment_concepts), así que
-- cada nivel vuelve a evaluar la política del anterior. Una consulta de 587 líneas leía
-- ~190.000 buffers y tardaba 1,1 s por sí sola; con los embebidos de PostgREST pasaba del
-- límite de 8 s.
--
-- Arreglo estándar de Supabase: envolver las llamadas en un subselect escalar —
-- `(select auth.uid())`— para que el planificador las evalúe **una vez por consulta**
-- (InitPlan) en lugar de una vez por fila. Las condiciones son las mismas: no cambia quién ve
-- qué, solo cuándo se evalúa.

-- ── user_roles: la evalúan TODAS las demás políticas, así que es la más crítica ──────────────
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL TO authenticated
  USING ((select public.is_admin()));

DROP POLICY IF EXISTS "School users can view roles in their school" ON public.user_roles;
CREATE POLICY "School users can view roles in their school" ON public.user_roles
  FOR SELECT
  USING (school_id IS NOT NULL AND public.user_shares_school((select auth.uid()), school_id));

DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- ── payments ────────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage all payments" ON public.payments;
CREATE POLICY "Admins can manage all payments" ON public.payments
  FOR ALL USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

DROP POLICY IF EXISTS "School users can manage their payments" ON public.payments;
CREATE POLICY "School users can manage their payments" ON public.payments
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = (select auth.uid()) AND ur.school_id = payments.school_id))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = (select auth.uid()) AND ur.school_id = payments.school_id));

DROP POLICY IF EXISTS "School users can delete their payments" ON public.payments;
CREATE POLICY "School users can delete their payments" ON public.payments
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = (select auth.uid()) AND ur.school_id = payments.school_id));

-- ── payment_items ───────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage all payment_items" ON public.payment_items;
CREATE POLICY "Admins can manage all payment_items" ON public.payment_items
  FOR ALL USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

DROP POLICY IF EXISTS "School users can manage their payment_items" ON public.payment_items;
CREATE POLICY "School users can manage their payment_items" ON public.payment_items
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.payments p
    JOIN public.user_roles ur ON ur.school_id = p.school_id
    WHERE p.id = payment_items.payment_id AND ur.user_id = (select auth.uid())))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.payments p
    JOIN public.user_roles ur ON ur.school_id = p.school_id
    WHERE p.id = payment_items.payment_id AND ur.user_id = (select auth.uid())));

-- ── payment_method_entries ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage all payment_method_entries" ON public.payment_method_entries;
CREATE POLICY "Admins can manage all payment_method_entries" ON public.payment_method_entries
  FOR ALL USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

DROP POLICY IF EXISTS "School users can manage their payment_method_entries" ON public.payment_method_entries;
CREATE POLICY "School users can manage their payment_method_entries" ON public.payment_method_entries
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.payments p
    JOIN public.user_roles ur ON ur.school_id = p.school_id
    WHERE p.id = payment_method_entries.payment_id AND ur.user_id = (select auth.uid())))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.payments p
    JOIN public.user_roles ur ON ur.school_id = p.school_id
    WHERE p.id = payment_method_entries.payment_id AND ur.user_id = (select auth.uid())));

-- ── payment_others ──────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "school_users_manage_payment_others" ON public.payment_others;
CREATE POLICY "school_users_manage_payment_others" ON public.payment_others
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = (select auth.uid()) AND ur.school_id = payment_others.school_id))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = (select auth.uid()) AND ur.school_id = payment_others.school_id));

-- ── Catálogo: planes y conceptos ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage all payment_plans" ON public.payment_plans;
CREATE POLICY "Admins can manage all payment_plans" ON public.payment_plans
  FOR ALL USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

DROP POLICY IF EXISTS "School users can manage their payment_plans" ON public.payment_plans;
CREATE POLICY "School users can manage their payment_plans" ON public.payment_plans
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = (select auth.uid()) AND ur.school_id = payment_plans.school_id))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = (select auth.uid()) AND ur.school_id = payment_plans.school_id));

DROP POLICY IF EXISTS "Admins can manage all payment_concepts" ON public.payment_concepts;
CREATE POLICY "Admins can manage all payment_concepts" ON public.payment_concepts
  FOR ALL USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

DROP POLICY IF EXISTS "School users can manage their payment_concepts" ON public.payment_concepts;
CREATE POLICY "School users can manage their payment_concepts" ON public.payment_concepts
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = (select auth.uid()) AND ur.school_id = payment_concepts.school_id))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = (select auth.uid()) AND ur.school_id = payment_concepts.school_id));

DROP POLICY IF EXISTS "Admins can manage all payment_plan_concepts" ON public.payment_plan_concepts;
CREATE POLICY "Admins can manage all payment_plan_concepts" ON public.payment_plan_concepts
  FOR ALL USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

DROP POLICY IF EXISTS "School users can manage their payment_plan_concepts" ON public.payment_plan_concepts;
CREATE POLICY "School users can manage their payment_plan_concepts" ON public.payment_plan_concepts
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.payment_plans pp
    JOIN public.user_roles ur ON ur.school_id = pp.school_id
    WHERE pp.id = payment_plan_concepts.plan_id AND ur.user_id = (select auth.uid())))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.payment_plans pp
    JOIN public.user_roles ur ON ur.school_id = pp.school_id
    WHERE pp.id = payment_plan_concepts.plan_id AND ur.user_id = (select auth.uid())));

-- ── Saldos y exoneraciones (mismo patrón, los lee el estado de cuenta y el dashboard) ────────
DROP POLICY IF EXISTS "Admins can manage all student_concept_balances" ON public.student_concept_balances;
CREATE POLICY "Admins can manage all student_concept_balances" ON public.student_concept_balances
  FOR ALL USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

DROP POLICY IF EXISTS "School users can manage their student_concept_balances" ON public.student_concept_balances;
CREATE POLICY "School users can manage their student_concept_balances" ON public.student_concept_balances
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = (select auth.uid()) AND ur.school_id = student_concept_balances.school_id))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = (select auth.uid()) AND ur.school_id = student_concept_balances.school_id));

DROP POLICY IF EXISTS "School users manage their concept_exonerations" ON public.concept_exonerations;
CREATE POLICY "School users manage their concept_exonerations" ON public.concept_exonerations
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = (select auth.uid()) AND ur.school_id = concept_exonerations.school_id))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = (select auth.uid()) AND ur.school_id = concept_exonerations.school_id));

DROP POLICY IF EXISTS "Families view their concept_exonerations" ON public.concept_exonerations;
CREATE POLICY "Families view their concept_exonerations" ON public.concept_exonerations
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.families f ON f.id = s.family_id
    WHERE s.id = concept_exonerations.student_id AND f.user_id = (select auth.uid())));

-- ── Índices y claves primarias que faltaban (drift respecto al esquema del repo) ─────────────
CREATE INDEX IF NOT EXISTS idx_payment_items_plan_concept ON public.payment_items(plan_concept_id);
CREATE INDEX IF NOT EXISTS idx_payment_others_payment ON public.payment_others(payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_school_year_date
  ON public.payments(school_id, school_year_id, payment_date DESC);

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['payments','payment_items','payment_method_entries','payment_plan_concepts','payment_plans','payment_concepts'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = format('public.%I', t)::regclass AND contype = 'p'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ADD PRIMARY KEY (id)', t);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
