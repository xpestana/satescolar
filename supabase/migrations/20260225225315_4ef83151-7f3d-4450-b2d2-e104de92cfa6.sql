CREATE TABLE public.email_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  sent_by uuid NOT NULL,
  recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  subject text NOT NULL,
  body_html text NOT NULL,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  recipient_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.email_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School users can view their email history"
  ON public.email_history FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.school_id = email_history.school_id
  ));

CREATE POLICY "School users can insert their email history"
  ON public.email_history FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.school_id = email_history.school_id
  ));

CREATE POLICY "Admins can manage all email history"
  ON public.email_history FOR ALL
  USING (is_admin());

CREATE INDEX idx_email_history_school_id ON public.email_history(school_id);
CREATE INDEX idx_email_history_created_at ON public.email_history(created_at DESC);