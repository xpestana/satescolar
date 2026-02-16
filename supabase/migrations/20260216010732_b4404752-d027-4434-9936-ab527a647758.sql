-- Add 'teacher' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'teacher';

-- Add user_id column to teachers table to link with auth user
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS user_id uuid;
