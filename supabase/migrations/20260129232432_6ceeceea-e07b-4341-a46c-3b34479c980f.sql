-- First, clean up existing data (foreign key constraints will block if we don't do this in order)
DELETE FROM public.parishes;
DELETE FROM public.cities;
DELETE FROM public.municipalities;
DELETE FROM public.states;

-- Alter cities table: change from municipality_id to state_id
ALTER TABLE public.cities DROP CONSTRAINT IF EXISTS cities_municipality_id_fkey;
ALTER TABLE public.cities DROP COLUMN IF EXISTS municipality_id;
ALTER TABLE public.cities ADD COLUMN IF NOT EXISTS state_id uuid REFERENCES public.states(id);

-- Alter parishes table: change from city_id to municipality_id
ALTER TABLE public.parishes DROP CONSTRAINT IF EXISTS parishes_city_id_fkey;
ALTER TABLE public.parishes DROP COLUMN IF EXISTS city_id;
ALTER TABLE public.parishes ADD COLUMN IF NOT EXISTS municipality_id uuid REFERENCES public.municipalities(id);

-- Also update schools table to reflect new structure: remove city_id and parish_id references and add new ones
ALTER TABLE public.schools DROP CONSTRAINT IF EXISTS schools_city_id_fkey;
ALTER TABLE public.schools DROP CONSTRAINT IF EXISTS schools_parish_id_fkey;

-- Remove old columns from schools if they exist with wrong FK
ALTER TABLE public.schools DROP COLUMN IF EXISTS city_id;
ALTER TABLE public.schools DROP COLUMN IF EXISTS parish_id;

-- Add correct columns (city references state, parish references municipality)
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS city_id uuid REFERENCES public.cities(id);
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS parish_id uuid REFERENCES public.parishes(id);

-- Add integer id columns for easier data import mapping
ALTER TABLE public.states ADD COLUMN IF NOT EXISTS legacy_id integer;
ALTER TABLE public.municipalities ADD COLUMN IF NOT EXISTS legacy_id integer;
ALTER TABLE public.cities ADD COLUMN IF NOT EXISTS legacy_id integer;
ALTER TABLE public.parishes ADD COLUMN IF NOT EXISTS legacy_id integer;