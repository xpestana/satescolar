ALTER TABLE primary_final_reports
  ADD COLUMN IF NOT EXISTS literal_numerico numeric DEFAULT NULL;
