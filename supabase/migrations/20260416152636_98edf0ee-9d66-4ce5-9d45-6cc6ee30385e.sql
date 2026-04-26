
-- ============================================================
-- MÓDULO AULA VIRTUAL — MIGRACIÓN FASE 1
-- ============================================================

-- Helper: check if user is teacher owner of an assignment
CREATE OR REPLACE FUNCTION public.teacher_owns_assignment(_user_id uuid, _assignment_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM subject_teacher_assignments sta
    JOIN teachers t ON t.id = sta.teacher_id
    WHERE sta.id = _assignment_id AND t.user_id = _user_id
  );
$$;

-- Helper: check if student is enrolled in assignment's section
CREATE OR REPLACE FUNCTION public.student_in_assignment(_student_id uuid, _assignment_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM subject_teacher_assignments sta
    JOIN enrollments e ON e.section_id = sta.section_id AND e.school_year_id = sta.school_year_id
    WHERE sta.id = _assignment_id AND e.student_id = _student_id
  );
$$;

-- Helper: check if representative's child is in assignment
CREATE OR REPLACE FUNCTION public.representative_child_in_assignment(_user_id uuid, _assignment_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM subject_teacher_assignments sta
    JOIN enrollments e ON e.section_id = sta.section_id AND e.school_year_id = sta.school_year_id
    JOIN students s ON s.id = e.student_id
    JOIN families f ON f.id = s.family_id
    WHERE sta.id = _assignment_id AND f.user_id = _user_id
  );
$$;

-- Helper: get student_id from family user
CREATE OR REPLACE FUNCTION public.user_is_student(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.id FROM students s
  JOIN families f ON f.id = s.family_id
  WHERE f.user_id = _user_id
  LIMIT 1;
$$;

-- ============================================================
-- 1. classroom_config
-- ============================================================
CREATE TABLE public.classroom_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL UNIQUE REFERENCES public.subject_teacher_assignments(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  cover_url text,
  color text NOT NULL DEFAULT '#4285f4',
  description text DEFAULT '',
  welcome_message text DEFAULT '',
  rules text DEFAULT '',
  allow_student_comments boolean NOT NULL DEFAULT true,
  allow_student_posts boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.classroom_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage their classroom config"
  ON public.classroom_config FOR ALL USING (teacher_owns_assignment(auth.uid(), assignment_id))
  WITH CHECK (teacher_owns_assignment(auth.uid(), assignment_id));

CREATE POLICY "School users can manage classroom config"
  ON public.classroom_config FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = classroom_config.school_id))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = classroom_config.school_id));

CREATE POLICY "Admins can manage all classroom config"
  ON public.classroom_config FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Students can view their classroom config"
  ON public.classroom_config FOR SELECT
  USING (representative_child_in_assignment(auth.uid(), assignment_id)
    OR EXISTS (
      SELECT 1 FROM subject_teacher_assignments sta
      JOIN enrollments e ON e.section_id = sta.section_id AND e.school_year_id = sta.school_year_id
      JOIN students s ON s.id = e.student_id
      JOIN families f ON f.id = s.family_id
      WHERE sta.id = assignment_id AND f.user_id = auth.uid()
    ));

-- ============================================================
-- 2. classroom_topics
-- ============================================================
CREATE TABLE public.classroom_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.subject_teacher_assignments(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  display_order integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.classroom_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage their topics"
  ON public.classroom_topics FOR ALL USING (teacher_owns_assignment(auth.uid(), assignment_id))
  WITH CHECK (teacher_owns_assignment(auth.uid(), assignment_id));

CREATE POLICY "School users can manage topics"
  ON public.classroom_topics FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = classroom_topics.school_id))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = classroom_topics.school_id));

CREATE POLICY "Admins can manage all topics"
  ON public.classroom_topics FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Students and reps can view visible topics"
  ON public.classroom_topics FOR SELECT
  USING (is_visible AND representative_child_in_assignment(auth.uid(), assignment_id));

-- ============================================================
-- 3. classroom_posts
-- ============================================================
CREATE TABLE public.classroom_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.subject_teacher_assignments(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  post_type text NOT NULL DEFAULT 'announcement' CHECK (post_type IN ('announcement','material','question')),
  title text DEFAULT '',
  content text NOT NULL DEFAULT '',
  is_pinned boolean NOT NULL DEFAULT false,
  allow_comments boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','scheduled','archived')),
  scheduled_at timestamptz,
  topic_id uuid REFERENCES public.classroom_topics(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.classroom_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage their posts"
  ON public.classroom_posts FOR ALL USING (teacher_owns_assignment(auth.uid(), assignment_id))
  WITH CHECK (teacher_owns_assignment(auth.uid(), assignment_id));

CREATE POLICY "School users can manage posts"
  ON public.classroom_posts FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = classroom_posts.school_id))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = classroom_posts.school_id));

CREATE POLICY "Admins can manage all posts"
  ON public.classroom_posts FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Students and reps can view published posts"
  ON public.classroom_posts FOR SELECT
  USING (status = 'published' AND representative_child_in_assignment(auth.uid(), assignment_id));

-- ============================================================
-- 4. classroom_post_attachments
-- ============================================================
CREATE TABLE public.classroom_post_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.classroom_posts(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text DEFAULT 'file',
  file_size bigint DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.classroom_post_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage post attachments"
  ON public.classroom_post_attachments FOR ALL
  USING (EXISTS (SELECT 1 FROM classroom_posts p WHERE p.id = post_id AND teacher_owns_assignment(auth.uid(), p.assignment_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM classroom_posts p WHERE p.id = post_id AND teacher_owns_assignment(auth.uid(), p.assignment_id)));

CREATE POLICY "School users can manage post attachments"
  ON public.classroom_post_attachments FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = classroom_post_attachments.school_id))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = classroom_post_attachments.school_id));

CREATE POLICY "Admins can manage all post attachments"
  ON public.classroom_post_attachments FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Students and reps can view post attachments"
  ON public.classroom_post_attachments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM classroom_posts p
    WHERE p.id = post_id AND p.status = 'published'
    AND representative_child_in_assignment(auth.uid(), p.assignment_id)
  ));

-- ============================================================
-- 5. classroom_activities
-- ============================================================
CREATE TABLE public.classroom_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.subject_teacher_assignments(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  topic_id uuid REFERENCES public.classroom_topics(id) ON DELETE SET NULL,
  evaluation_plan_item_id uuid REFERENCES public.evaluation_plan_items(id) ON DELETE SET NULL,
  activity_type text NOT NULL DEFAULT 'task' CHECK (activity_type IN ('task','quiz','forum','material','link','video','document','evaluated','non_evaluated')),
  title text NOT NULL,
  description text DEFAULT '',
  instructions text DEFAULT '',
  max_score numeric DEFAULT 0,
  due_date timestamptz,
  publish_date timestamptz,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','scheduled','archived')),
  allow_late_submission boolean NOT NULL DEFAULT false,
  allow_resubmission boolean NOT NULL DEFAULT false,
  external_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.classroom_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage their activities"
  ON public.classroom_activities FOR ALL USING (teacher_owns_assignment(auth.uid(), assignment_id))
  WITH CHECK (teacher_owns_assignment(auth.uid(), assignment_id));

CREATE POLICY "School users can manage activities"
  ON public.classroom_activities FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = classroom_activities.school_id))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = classroom_activities.school_id));

CREATE POLICY "Admins can manage all activities"
  ON public.classroom_activities FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Students and reps can view published activities"
  ON public.classroom_activities FOR SELECT
  USING (status = 'published' AND representative_child_in_assignment(auth.uid(), assignment_id));

-- ============================================================
-- 6. classroom_activity_attachments
-- ============================================================
CREATE TABLE public.classroom_activity_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.classroom_activities(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text DEFAULT 'file',
  file_size bigint DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.classroom_activity_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage activity attachments"
  ON public.classroom_activity_attachments FOR ALL
  USING (EXISTS (SELECT 1 FROM classroom_activities a WHERE a.id = activity_id AND teacher_owns_assignment(auth.uid(), a.assignment_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM classroom_activities a WHERE a.id = activity_id AND teacher_owns_assignment(auth.uid(), a.assignment_id)));

CREATE POLICY "School users can manage activity attachments"
  ON public.classroom_activity_attachments FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = classroom_activity_attachments.school_id))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = classroom_activity_attachments.school_id));

CREATE POLICY "Admins can manage all activity attachments"
  ON public.classroom_activity_attachments FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Students and reps can view activity attachments"
  ON public.classroom_activity_attachments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM classroom_activities a
    WHERE a.id = activity_id AND a.status = 'published'
    AND representative_child_in_assignment(auth.uid(), a.assignment_id)
  ));

-- ============================================================
-- 7. classroom_submissions
-- ============================================================
CREATE TABLE public.classroom_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.classroom_activities(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  content text DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','submitted','submitted_late','reviewed','graded','expired','not_submitted')),
  score numeric,
  feedback text DEFAULT '',
  submitted_at timestamptz,
  graded_at timestamptz,
  graded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(activity_id, student_id)
);

ALTER TABLE public.classroom_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage submissions for their activities"
  ON public.classroom_submissions FOR ALL
  USING (EXISTS (SELECT 1 FROM classroom_activities a WHERE a.id = activity_id AND teacher_owns_assignment(auth.uid(), a.assignment_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM classroom_activities a WHERE a.id = activity_id AND teacher_owns_assignment(auth.uid(), a.assignment_id)));

CREATE POLICY "Students can manage their own submissions"
  ON public.classroom_submissions FOR ALL
  USING (EXISTS (SELECT 1 FROM students s JOIN families f ON f.id = s.family_id WHERE s.id = student_id AND f.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM students s JOIN families f ON f.id = s.family_id WHERE s.id = student_id AND f.user_id = auth.uid()));

CREATE POLICY "Reps can view their children submissions"
  ON public.classroom_submissions FOR SELECT
  USING (EXISTS (SELECT 1 FROM students s JOIN families f ON f.id = s.family_id WHERE s.id = student_id AND f.user_id = auth.uid()));

CREATE POLICY "School users can manage submissions"
  ON public.classroom_submissions FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = classroom_submissions.school_id))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = classroom_submissions.school_id));

CREATE POLICY "Admins can manage all submissions"
  ON public.classroom_submissions FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- 8. classroom_submission_attachments
-- ============================================================
CREATE TABLE public.classroom_submission_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.classroom_submissions(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text DEFAULT 'file',
  file_size bigint DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.classroom_submission_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Submission owners can manage their attachments"
  ON public.classroom_submission_attachments FOR ALL
  USING (EXISTS (
    SELECT 1 FROM classroom_submissions sub
    JOIN students s ON s.id = sub.student_id
    JOIN families f ON f.id = s.family_id
    WHERE sub.id = submission_id AND f.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM classroom_submissions sub
    JOIN students s ON s.id = sub.student_id
    JOIN families f ON f.id = s.family_id
    WHERE sub.id = submission_id AND f.user_id = auth.uid()
  ));

CREATE POLICY "Teachers can view submission attachments"
  ON public.classroom_submission_attachments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM classroom_submissions sub
    JOIN classroom_activities a ON a.id = sub.activity_id
    WHERE sub.id = submission_id AND teacher_owns_assignment(auth.uid(), a.assignment_id)
  ));

CREATE POLICY "School users can view submission attachments"
  ON public.classroom_submission_attachments FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = classroom_submission_attachments.school_id))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = classroom_submission_attachments.school_id));

CREATE POLICY "Admins can manage all submission attachments"
  ON public.classroom_submission_attachments FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- 9. classroom_comments
-- ============================================================
CREATE TABLE public.classroom_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.classroom_posts(id) ON DELETE CASCADE,
  activity_id uuid REFERENCES public.classroom_activities(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  content text NOT NULL DEFAULT '',
  is_private boolean NOT NULL DEFAULT false,
  target_student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (post_id IS NOT NULL OR activity_id IS NOT NULL)
);

ALTER TABLE public.classroom_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage comments on their content"
  ON public.classroom_comments FOR ALL
  USING (
    (post_id IS NOT NULL AND EXISTS (SELECT 1 FROM classroom_posts p WHERE p.id = post_id AND teacher_owns_assignment(auth.uid(), p.assignment_id)))
    OR
    (activity_id IS NOT NULL AND EXISTS (SELECT 1 FROM classroom_activities a WHERE a.id = activity_id AND teacher_owns_assignment(auth.uid(), a.assignment_id)))
  )
  WITH CHECK (
    (post_id IS NOT NULL AND EXISTS (SELECT 1 FROM classroom_posts p WHERE p.id = post_id AND teacher_owns_assignment(auth.uid(), p.assignment_id)))
    OR
    (activity_id IS NOT NULL AND EXISTS (SELECT 1 FROM classroom_activities a WHERE a.id = activity_id AND teacher_owns_assignment(auth.uid(), a.assignment_id)))
  );

CREATE POLICY "Users can manage their own comments"
  ON public.classroom_comments FOR ALL
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

CREATE POLICY "Students can view public comments on their assignments"
  ON public.classroom_comments FOR SELECT
  USING (
    NOT is_private AND (
      (post_id IS NOT NULL AND EXISTS (SELECT 1 FROM classroom_posts p WHERE p.id = post_id AND representative_child_in_assignment(auth.uid(), p.assignment_id)))
      OR
      (activity_id IS NOT NULL AND EXISTS (SELECT 1 FROM classroom_activities a WHERE a.id = activity_id AND representative_child_in_assignment(auth.uid(), a.assignment_id)))
    )
  );

CREATE POLICY "Students can view private comments targeted to them"
  ON public.classroom_comments FOR SELECT
  USING (
    is_private AND target_student_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM students s JOIN families f ON f.id = s.family_id WHERE s.id = target_student_id AND f.user_id = auth.uid())
  );

CREATE POLICY "School users can manage comments"
  ON public.classroom_comments FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = classroom_comments.school_id))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = classroom_comments.school_id));

CREATE POLICY "Admins can manage all comments"
  ON public.classroom_comments FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- 10. classroom_rubrics
-- ============================================================
CREATE TABLE public.classroom_rubrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL UNIQUE REFERENCES public.classroom_activities(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Rúbrica',
  max_score numeric NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.classroom_rubrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage their rubrics"
  ON public.classroom_rubrics FOR ALL
  USING (EXISTS (SELECT 1 FROM classroom_activities a WHERE a.id = activity_id AND teacher_owns_assignment(auth.uid(), a.assignment_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM classroom_activities a WHERE a.id = activity_id AND teacher_owns_assignment(auth.uid(), a.assignment_id)));

CREATE POLICY "Students and reps can view rubrics"
  ON public.classroom_rubrics FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM classroom_activities a
    WHERE a.id = activity_id AND a.status = 'published'
    AND representative_child_in_assignment(auth.uid(), a.assignment_id)
  ));

CREATE POLICY "School users can manage rubrics"
  ON public.classroom_rubrics FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = classroom_rubrics.school_id))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = classroom_rubrics.school_id));

CREATE POLICY "Admins can manage all rubrics"
  ON public.classroom_rubrics FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- 11. classroom_rubric_criteria
-- ============================================================
CREATE TABLE public.classroom_rubric_criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rubric_id uuid NOT NULL REFERENCES public.classroom_rubrics(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  criterion_name text NOT NULL,
  description text DEFAULT '',
  max_points numeric NOT NULL DEFAULT 0,
  display_order integer NOT NULL DEFAULT 0,
  levels jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.classroom_rubric_criteria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage rubric criteria"
  ON public.classroom_rubric_criteria FOR ALL
  USING (EXISTS (
    SELECT 1 FROM classroom_rubrics r
    JOIN classroom_activities a ON a.id = r.activity_id
    WHERE r.id = rubric_id AND teacher_owns_assignment(auth.uid(), a.assignment_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM classroom_rubrics r
    JOIN classroom_activities a ON a.id = r.activity_id
    WHERE r.id = rubric_id AND teacher_owns_assignment(auth.uid(), a.assignment_id)
  ));

CREATE POLICY "Students and reps can view rubric criteria"
  ON public.classroom_rubric_criteria FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM classroom_rubrics r
    JOIN classroom_activities a ON a.id = r.activity_id
    WHERE r.id = rubric_id AND a.status = 'published'
    AND representative_child_in_assignment(auth.uid(), a.assignment_id)
  ));

CREATE POLICY "School users can manage rubric criteria"
  ON public.classroom_rubric_criteria FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = classroom_rubric_criteria.school_id))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = classroom_rubric_criteria.school_id));

CREATE POLICY "Admins can manage all rubric criteria"
  ON public.classroom_rubric_criteria FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- 12. classroom_events
-- ============================================================
CREATE TABLE public.classroom_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.subject_teacher_assignments(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  event_date timestamptz NOT NULL,
  event_end_date timestamptz,
  event_type text NOT NULL DEFAULT 'custom' CHECK (event_type IN ('custom','evaluation','deadline','class')),
  activity_id uuid REFERENCES public.classroom_activities(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.classroom_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage their events"
  ON public.classroom_events FOR ALL USING (teacher_owns_assignment(auth.uid(), assignment_id))
  WITH CHECK (teacher_owns_assignment(auth.uid(), assignment_id));

CREATE POLICY "Students and reps can view events"
  ON public.classroom_events FOR SELECT
  USING (representative_child_in_assignment(auth.uid(), assignment_id));

CREATE POLICY "School users can manage events"
  ON public.classroom_events FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = classroom_events.school_id))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = classroom_events.school_id));

CREATE POLICY "Admins can manage all events"
  ON public.classroom_events FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- 13. classroom_access_codes
-- ============================================================
CREATE TABLE public.classroom_access_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  school_year_id uuid NOT NULL REFERENCES public.school_years(id) ON DELETE CASCADE,
  access_code text NOT NULL DEFAULT substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  is_active boolean NOT NULL DEFAULT true,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, school_year_id)
);

ALTER TABLE public.classroom_access_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reps can view their children access codes"
  ON public.classroom_access_codes FOR SELECT
  USING (EXISTS (SELECT 1 FROM students s JOIN families f ON f.id = s.family_id WHERE s.id = student_id AND f.user_id = auth.uid()));

CREATE POLICY "School users can manage access codes"
  ON public.classroom_access_codes FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = classroom_access_codes.school_id))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = classroom_access_codes.school_id));

CREATE POLICY "Admins can manage all access codes"
  ON public.classroom_access_codes FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- 14. classroom_access_log
-- ============================================================
CREATE TABLE public.classroom_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  access_type text NOT NULL DEFAULT 'login' CHECK (access_type IN ('login','failed','locked')),
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.classroom_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School users can view access logs"
  ON public.classroom_access_log FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = classroom_access_log.school_id));

CREATE POLICY "Authenticated users can insert access logs"
  ON public.classroom_access_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all access logs"
  ON public.classroom_access_log FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- 15. classroom_notifications
-- ============================================================
CREATE TABLE public.classroom_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL,
  notification_type text NOT NULL CHECK (notification_type IN ('new_post','new_activity','due_soon','overdue','graded','comment','reminder')),
  title text NOT NULL,
  message text DEFAULT '',
  reference_type text,
  reference_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.classroom_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON public.classroom_notifications FOR SELECT
  USING (recipient_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON public.classroom_notifications FOR UPDATE
  USING (recipient_id = auth.uid());

CREATE POLICY "School users can insert notifications"
  ON public.classroom_notifications FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = classroom_notifications.school_id)
    OR is_admin());

CREATE POLICY "Admins can manage all notifications"
  ON public.classroom_notifications FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_classroom_config_assignment ON public.classroom_config(assignment_id);
CREATE INDEX idx_classroom_topics_assignment ON public.classroom_topics(assignment_id);
CREATE INDEX idx_classroom_posts_assignment ON public.classroom_posts(assignment_id);
CREATE INDEX idx_classroom_posts_status ON public.classroom_posts(status);
CREATE INDEX idx_classroom_activities_assignment ON public.classroom_activities(assignment_id);
CREATE INDEX idx_classroom_activities_topic ON public.classroom_activities(topic_id);
CREATE INDEX idx_classroom_activities_status ON public.classroom_activities(status);
CREATE INDEX idx_classroom_submissions_activity ON public.classroom_submissions(activity_id);
CREATE INDEX idx_classroom_submissions_student ON public.classroom_submissions(student_id);
CREATE INDEX idx_classroom_comments_post ON public.classroom_comments(post_id);
CREATE INDEX idx_classroom_comments_activity ON public.classroom_comments(activity_id);
CREATE INDEX idx_classroom_events_assignment ON public.classroom_events(assignment_id);
CREATE INDEX idx_classroom_events_date ON public.classroom_events(event_date);
CREATE INDEX idx_classroom_access_codes_student ON public.classroom_access_codes(student_id);
CREATE INDEX idx_classroom_notifications_recipient ON public.classroom_notifications(recipient_id);
CREATE INDEX idx_classroom_notifications_read ON public.classroom_notifications(is_read);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
CREATE TRIGGER update_classroom_config_updated_at BEFORE UPDATE ON public.classroom_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_classroom_topics_updated_at BEFORE UPDATE ON public.classroom_topics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_classroom_posts_updated_at BEFORE UPDATE ON public.classroom_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_classroom_activities_updated_at BEFORE UPDATE ON public.classroom_activities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_classroom_submissions_updated_at BEFORE UPDATE ON public.classroom_submissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_classroom_comments_updated_at BEFORE UPDATE ON public.classroom_comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_classroom_rubrics_updated_at BEFORE UPDATE ON public.classroom_rubrics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_classroom_rubric_criteria_updated_at BEFORE UPDATE ON public.classroom_rubric_criteria FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_classroom_events_updated_at BEFORE UPDATE ON public.classroom_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_classroom_access_codes_updated_at BEFORE UPDATE ON public.classroom_access_codes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- STORAGE BUCKET
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('classroom-files', 'classroom-files', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload classroom files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'classroom-files');

CREATE POLICY "Anyone can view classroom files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'classroom-files');

CREATE POLICY "Authenticated users can update their classroom files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'classroom-files');

CREATE POLICY "Authenticated users can delete their classroom files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'classroom-files');
