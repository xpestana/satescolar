-- Per-teacher signature printed on the boletas they author (primaria descriptivo).
-- Kept out of public.teachers so a teacher can edit their own signature without
-- being granted UPDATE over form_data / is_suspended on their teacher record.
CREATE TABLE IF NOT EXISTS public.teacher_signatures (
  teacher_id uuid NOT NULL PRIMARY KEY REFERENCES public.teachers(id) ON DELETE CASCADE,
  school_id  uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  nombre     text NOT NULL DEFAULT '',
  cedula     text NOT NULL DEFAULT '',
  cargo      text NOT NULL DEFAULT '',
  firma_url  text NOT NULL DEFAULT '',
  sello_url  text NOT NULL DEFAULT '',
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teacher_signatures_school_id
  ON public.teacher_signatures(school_id);

ALTER TABLE public.teacher_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all teacher signatures"
  ON public.teacher_signatures FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "School users can manage their teacher signatures"
  ON public.teacher_signatures FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = teacher_signatures.school_id))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = teacher_signatures.school_id));

CREATE POLICY "Teachers can manage their own signature"
  ON public.teacher_signatures FOR ALL
  USING (EXISTS (SELECT 1 FROM teachers t WHERE t.id = teacher_signatures.teacher_id AND t.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM teachers t WHERE t.id = teacher_signatures.teacher_id AND t.user_id = auth.uid()));

CREATE TRIGGER update_teacher_signatures_updated_at
  BEFORE UPDATE ON public.teacher_signatures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
