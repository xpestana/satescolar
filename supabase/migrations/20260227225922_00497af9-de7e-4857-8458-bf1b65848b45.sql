
CREATE TABLE public.evaluation_plan_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES public.subject_teacher_assignments(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id),
  description TEXT NOT NULL,
  percentage NUMERIC NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.evaluation_plan_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage their evaluation plans"
  ON public.evaluation_plan_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.subject_teacher_assignments sta
      JOIN public.teachers t ON t.id = sta.teacher_id
      WHERE sta.id = evaluation_plan_items.assignment_id
      AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "School users can view evaluation plans"
  ON public.evaluation_plan_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.school_id = evaluation_plan_items.school_id
    )
  );

CREATE POLICY "Admins can manage all evaluation plans"
  ON public.evaluation_plan_items FOR ALL
  USING (is_admin());
