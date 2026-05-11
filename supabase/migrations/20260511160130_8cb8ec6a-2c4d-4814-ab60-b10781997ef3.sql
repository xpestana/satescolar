
DROP INDEX IF EXISTS public.classroom_reactions_post_unique;
DROP INDEX IF EXISTS public.classroom_reactions_activity_unique;

CREATE UNIQUE INDEX classroom_reactions_post_unique
  ON public.classroom_reactions (author_id, post_id, emoji, COALESCE(as_student_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE post_id IS NOT NULL;

CREATE UNIQUE INDEX classroom_reactions_activity_unique
  ON public.classroom_reactions (author_id, activity_id, emoji, COALESCE(as_student_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE activity_id IS NOT NULL;
