-- Email templates: one row per school + template type
CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  template_type text NOT NULL
    CHECK (template_type IN ('welcome-family','welcome-teacher','delinquency','payment-reminder')),
  subject text NOT NULL,
  body_html text NOT NULL,
  primary_color text NOT NULL DEFAULT '#1e78c8',
  text_color text NOT NULL DEFAULT '#ffffff',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(school_id, template_type)
);

CREATE INDEX idx_email_templates_school_type ON public.email_templates(school_id, template_type);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- School users can manage their own school's templates
CREATE POLICY "school_manage_email_templates"
  ON public.email_templates
  FOR ALL
  USING (
    school_id IN (
      SELECT school_id FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'school'
    )
  )
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'school'
    )
  );

-- Admins can read all templates
CREATE POLICY "admin_read_email_templates"
  ON public.email_templates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
