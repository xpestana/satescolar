
-- 1. Create attendance_tokens table
CREATE TABLE public.attendance_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  entity_type text NOT NULL CHECK (entity_type IN ('student', 'teacher', 'representative')),
  entity_id uuid NOT NULL,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_attendance_tokens_entity ON public.attendance_tokens (entity_type, entity_id);
CREATE INDEX idx_attendance_tokens_token ON public.attendance_tokens (token);

-- 2. Create attendance_records table
CREATE TABLE public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('student', 'teacher', 'representative')),
  entity_id uuid NOT NULL,
  token_id uuid REFERENCES public.attendance_tokens(id),
  attendance_date date NOT NULL DEFAULT CURRENT_DATE,
  attendance_time time NOT NULL DEFAULT CURRENT_TIME,
  attendance_timestamp timestamptz NOT NULL DEFAULT now(),
  record_type text NOT NULL DEFAULT 'qr',
  status text NOT NULL DEFAULT 'present',
  notification_sent boolean NOT NULL DEFAULT false,
  notification_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_attendance_records_entity ON public.attendance_records (entity_type, entity_id, attendance_date);
CREATE INDEX idx_attendance_records_school ON public.attendance_records (school_id);

-- 3. Enable RLS
ALTER TABLE public.attendance_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies
CREATE POLICY "School users can view their tokens"
  ON public.attendance_tokens FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = attendance_tokens.school_id));

CREATE POLICY "Admins can manage all tokens"
  ON public.attendance_tokens FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "School users can view their attendance"
  ON public.attendance_records FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.school_id = attendance_records.school_id));

CREATE POLICY "Admins can manage all attendance"
  ON public.attendance_records FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- 5. Trigger function
CREATE OR REPLACE FUNCTION public.create_attendance_token()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_entity_type text := TG_ARGV[0];
BEGIN
  IF v_entity_type = 'teacher' THEN
    v_school_id := NEW.school_id;
  ELSIF v_entity_type = 'representative' THEN
    SELECT fs.school_id INTO v_school_id FROM public.family_schools fs WHERE fs.family_id = NEW.family_id LIMIT 1;
  END IF;

  IF v_school_id IS NOT NULL THEN
    INSERT INTO public.attendance_tokens (entity_type, entity_id, school_id)
    VALUES (v_entity_type, NEW.id, v_school_id)
    ON CONFLICT (entity_type, entity_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Student token via student_schools trigger
CREATE OR REPLACE FUNCTION public.create_student_attendance_token()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.attendance_tokens (entity_type, entity_id, school_id)
  VALUES ('student', NEW.student_id, NEW.school_id)
  ON CONFLICT (entity_type, entity_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 6. Attach triggers
CREATE TRIGGER trg_teacher_attendance_token
  AFTER INSERT ON public.teachers
  FOR EACH ROW EXECUTE FUNCTION public.create_attendance_token('teacher');

CREATE TRIGGER trg_representative_attendance_token
  AFTER INSERT ON public.representatives
  FOR EACH ROW EXECUTE FUNCTION public.create_attendance_token('representative');

CREATE TRIGGER trg_student_attendance_token
  AFTER INSERT ON public.student_schools
  FOR EACH ROW EXECUTE FUNCTION public.create_student_attendance_token();

-- 7. Backfill existing
INSERT INTO public.attendance_tokens (entity_type, entity_id, school_id)
SELECT DISTINCT 'student', ss.student_id, ss.school_id FROM public.student_schools ss
ON CONFLICT (entity_type, entity_id) DO NOTHING;

INSERT INTO public.attendance_tokens (entity_type, entity_id, school_id)
SELECT 'teacher', t.id, t.school_id FROM public.teachers t
ON CONFLICT (entity_type, entity_id) DO NOTHING;

INSERT INTO public.attendance_tokens (entity_type, entity_id, school_id)
SELECT DISTINCT 'representative', r.id, fs.school_id
FROM public.representatives r
JOIN public.family_schools fs ON fs.family_id = r.family_id
ON CONFLICT (entity_type, entity_id) DO NOTHING;
