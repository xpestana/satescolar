
CREATE TABLE public.school_payment_methods (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  method_type text NOT NULL,
  label text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.school_payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all school_payment_methods"
  ON public.school_payment_methods FOR ALL TO public
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "School users can view their school_payment_methods"
  ON public.school_payment_methods FOR SELECT TO public
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = school_payment_methods.school_id));

CREATE POLICY "School users can insert their school_payment_methods"
  ON public.school_payment_methods FOR INSERT TO public
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = school_payment_methods.school_id));

CREATE POLICY "School users can update their school_payment_methods"
  ON public.school_payment_methods FOR UPDATE TO public
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = school_payment_methods.school_id));

CREATE POLICY "School users can delete their school_payment_methods"
  ON public.school_payment_methods FOR DELETE TO public
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = school_payment_methods.school_id));
