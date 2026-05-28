-- Fix: PostgREST ON CONFLICT does not support partial unique indexes.
-- The previous index had WHERE record_type = 'manual', which PostgREST cannot
-- reference in its on_conflict= query parameter (error 42P10).
--
-- A full unique index works correctly because PostgreSQL treats NULLs as DISTINCT
-- by default: QR records (with NULL section_id / subject_id / momento) are each
-- considered unique and will never trigger a conflict with each other or with
-- manual records.

DROP INDEX IF EXISTS public.uq_manual_attendance_idx;

CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_record_idx
  ON public.attendance_records(entity_id, attendance_date, section_id, subject_id, momento);
