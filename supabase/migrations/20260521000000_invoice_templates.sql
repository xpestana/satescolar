-- Invoice templates table: stores field position configs for physical invoice overlay printing
CREATE TABLE invoice_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  paper_width_mm numeric NOT NULL DEFAULT 215.9,  -- letter width
  paper_height_mm numeric NOT NULL DEFAULT 279.4, -- letter height
  background_image_url text,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE invoice_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school_users_manage_invoice_templates" ON invoice_templates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.school_id = invoice_templates.school_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.school_id = invoice_templates.school_id
    )
  );
