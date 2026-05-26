ALTER TABLE boleta_templates
  ADD COLUMN IF NOT EXISTS applicable_grades text[] DEFAULT NULL;
