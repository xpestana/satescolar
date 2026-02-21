
-- Add is_primary column to representatives
ALTER TABLE public.representatives ADD COLUMN is_primary boolean NOT NULL DEFAULT false;

-- Mark the oldest representative per family as primary (for existing data)
UPDATE public.representatives r
SET is_primary = true
FROM (
  SELECT DISTINCT ON (family_id) id
  FROM public.representatives
  ORDER BY family_id, created_at ASC
) oldest
WHERE r.id = oldest.id;
