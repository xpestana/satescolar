-- Add page_break_before column to enrollment_planilla_sections
-- Allows configuring which sections should start on a new page in the PDF
ALTER TABLE public.enrollment_planilla_sections
  ADD COLUMN IF NOT EXISTS page_break_before boolean NOT NULL DEFAULT false;
