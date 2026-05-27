-- Boleta templates: one row per boleta layout saved by the school
CREATE TABLE IF NOT EXISTS boleta_templates (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name             text        NOT NULL,
  description      text,
  level            text        NOT NULL DEFAULT 'bachillerato',
  paper_width_mm   numeric     NOT NULL DEFAULT 215.9,
  paper_height_mm  numeric     NOT NULL DEFAULT 279.4,
  config           jsonb       NOT NULL DEFAULT '{}',
  is_active        boolean     NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE boleta_templates ENABLE ROW LEVEL SECURITY;

-- School users can CRUD their own templates
CREATE POLICY "school_boleta_templates_all"
  ON boleta_templates
  FOR ALL
  USING (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM user_roles WHERE user_id = auth.uid()
    )
  );
