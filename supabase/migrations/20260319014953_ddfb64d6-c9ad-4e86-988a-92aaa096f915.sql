
-- Create document_templates table
CREATE TABLE public.document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  content_html text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "School users can view their templates"
ON public.document_templates FOR SELECT
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.school_id = document_templates.school_id
));

CREATE POLICY "School users can insert their templates"
ON public.document_templates FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.school_id = document_templates.school_id
));

CREATE POLICY "School users can update their templates"
ON public.document_templates FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.school_id = document_templates.school_id
));

CREATE POLICY "School users can delete their templates"
ON public.document_templates FOR DELETE
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.school_id = document_templates.school_id
));

CREATE POLICY "Admins can manage all templates"
ON public.document_templates FOR ALL
USING (is_admin());

-- Updated_at trigger
CREATE TRIGGER update_document_templates_updated_at
  BEFORE UPDATE ON public.document_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
