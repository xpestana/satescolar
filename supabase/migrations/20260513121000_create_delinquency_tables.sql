-- Configuración de morosidad por colegio (una fila por colegio)
CREATE TABLE IF NOT EXISTS public.delinquency_config (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id               uuid        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  overdue_after_day       int         NOT NULL DEFAULT 0,
  reminder_mode           text        NOT NULL DEFAULT 'never',
  reminder_days_of_week   jsonb,
  reminder_days_of_month  jsonb,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT delinquency_config_school_id_key UNIQUE (school_id),
  CONSTRAINT delinquency_config_reminder_mode_check
    CHECK (reminder_mode IN ('never', 'daily', 'weekly', 'monthly_days'))
);

CREATE INDEX IF NOT EXISTS idx_delinquency_config_school
  ON public.delinquency_config (school_id);

ALTER TABLE public.delinquency_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School users manage their delinquency config"
  ON public.delinquency_config FOR ALL TO authenticated
  USING  (public.user_shares_school(auth.uid(), school_id))
  WITH CHECK (public.user_shares_school(auth.uid(), school_id));

CREATE TRIGGER trg_delinquency_config_updated
  BEFORE UPDATE ON public.delinquency_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Historial de recordatorios de morosidad enviados a familias
CREATE TABLE IF NOT EXISTS public.delinquency_notifications (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        uuid        NOT NULL REFERENCES public.schools(id)   ON DELETE CASCADE,
  student_id       uuid        NOT NULL REFERENCES public.students(id)  ON DELETE CASCADE,
  family_id        uuid        NOT NULL REFERENCES public.families(id)  ON DELETE CASCADE,
  email_sent_to    text        NOT NULL,
  total_owed_ves   numeric     NOT NULL DEFAULT 0,
  concepts_detail  jsonb       NOT NULL DEFAULT '[]',
  status           text        NOT NULL DEFAULT 'sent',
  error_message    text,
  sent_at          timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT delinquency_notifications_status_check
    CHECK (status IN ('sent', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_delinquency_notif_school_student
  ON public.delinquency_notifications (school_id, student_id);
CREATE INDEX IF NOT EXISTS idx_delinquency_notif_sent_at
  ON public.delinquency_notifications (sent_at DESC);

ALTER TABLE public.delinquency_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School users read their delinquency notifications"
  ON public.delinquency_notifications FOR SELECT TO authenticated
  USING (public.user_shares_school(auth.uid(), school_id));

CREATE POLICY "Service role inserts delinquency notifications"
  ON public.delinquency_notifications FOR INSERT TO authenticated
  WITH CHECK (public.user_shares_school(auth.uid(), school_id));

NOTIFY pgrst, 'reload schema';
