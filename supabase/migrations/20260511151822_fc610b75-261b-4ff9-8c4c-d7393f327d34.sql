
-- Reactions to posts and activities (emoji)
CREATE TABLE IF NOT EXISTS public.classroom_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  post_id uuid REFERENCES public.classroom_posts(id) ON DELETE CASCADE,
  activity_id uuid REFERENCES public.classroom_activities(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classroom_reactions_target_chk CHECK (
    (post_id IS NOT NULL AND activity_id IS NULL) OR
    (post_id IS NULL AND activity_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS classroom_reactions_post_unique
  ON public.classroom_reactions (author_id, post_id, emoji)
  WHERE post_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS classroom_reactions_activity_unique
  ON public.classroom_reactions (author_id, activity_id, emoji)
  WHERE activity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS classroom_reactions_post_idx ON public.classroom_reactions (post_id);
CREATE INDEX IF NOT EXISTS classroom_reactions_activity_idx ON public.classroom_reactions (activity_id);

ALTER TABLE public.classroom_reactions ENABLE ROW LEVEL SECURITY;

-- Admins manage all
CREATE POLICY "Admins can manage all reactions"
  ON public.classroom_reactions FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

-- School users (same school) manage all
CREATE POLICY "School users can manage reactions"
  ON public.classroom_reactions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.school_id = classroom_reactions.school_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.school_id = classroom_reactions.school_id
  ));

-- Teachers manage reactions on their content
CREATE POLICY "Teachers can manage reactions on their content"
  ON public.classroom_reactions FOR ALL
  USING (
    (post_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM classroom_posts p
      WHERE p.id = classroom_reactions.post_id
        AND teacher_owns_assignment(auth.uid(), p.assignment_id)
    )) OR
    (activity_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM classroom_activities a
      WHERE a.id = classroom_reactions.activity_id
        AND teacher_owns_assignment(auth.uid(), a.assignment_id)
    ))
  )
  WITH CHECK (
    (post_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM classroom_posts p
      WHERE p.id = classroom_reactions.post_id
        AND teacher_owns_assignment(auth.uid(), p.assignment_id)
    )) OR
    (activity_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM classroom_activities a
      WHERE a.id = classroom_reactions.activity_id
        AND teacher_owns_assignment(auth.uid(), a.assignment_id)
    ))
  );

-- Representatives can view reactions on their child's assignments
CREATE POLICY "Representatives can view reactions on child assignments"
  ON public.classroom_reactions FOR SELECT
  USING (
    (post_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM classroom_posts p
      WHERE p.id = classroom_reactions.post_id
        AND representative_child_in_assignment(auth.uid(), p.assignment_id)
    )) OR
    (activity_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM classroom_activities a
      WHERE a.id = classroom_reactions.activity_id
        AND representative_child_in_assignment(auth.uid(), a.assignment_id)
    ))
  );

-- Anyone authenticated can manage their own reactions (so representatives can react)
CREATE POLICY "Users can manage their own reactions"
  ON public.classroom_reactions FOR ALL
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());
