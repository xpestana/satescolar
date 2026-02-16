-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "School users can view roles in their school" ON public.user_roles;

-- Create a SECURITY DEFINER function to check school membership
CREATE OR REPLACE FUNCTION public.user_shares_school(requesting_user_id uuid, target_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = requesting_user_id
    AND school_id = target_school_id
  )
$$;

-- Recreate the policy using the SECURITY DEFINER function
CREATE POLICY "School users can view roles in their school"
ON public.user_roles
FOR SELECT
USING (
  user_roles.school_id IS NOT NULL
  AND public.user_shares_school(auth.uid(), user_roles.school_id)
);