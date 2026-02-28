
-- Delete all existing student grades and evaluation plan items
DELETE FROM public.student_grades;
DELETE FROM public.evaluation_plan_items;

-- Add momento column to evaluation_plan_items
ALTER TABLE public.evaluation_plan_items ADD COLUMN momento integer NOT NULL DEFAULT 1;

-- Add a constraint to ensure momento is 1, 2, or 3
ALTER TABLE public.evaluation_plan_items ADD CONSTRAINT evaluation_plan_items_momento_check CHECK (momento >= 1 AND momento <= 3);

-- Drop the old unique constraint if exists and create new one including momento
ALTER TABLE public.evaluation_plan_items DROP CONSTRAINT IF EXISTS evaluation_plan_items_student_evaluation_unique;

-- Update student_grades unique constraint to also consider momento context
-- The existing unique on (student_id, evaluation_plan_item_id) is fine since plan items are already scoped to a momento
