-- Inicialización de roles necesarios para Supabase local
-- Este script se ejecuta automáticamente al crear el contenedor de PostgreSQL

-- Crear roles si no existen
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator NOINHERIT LOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin NOINHERIT CREATEROLE LOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    CREATE ROLE supabase_storage_admin NOINHERIT CREATEROLE LOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    CREATE ROLE supabase_admin NOINHERIT CREATEROLE LOGIN;
  END IF;
END
$$;

-- Asignar contraseñas (mismas que POSTGRES_PASSWORD, configuradas por env)
-- La imagen de supabase/postgres ya maneja esto en la mayoría de los casos

-- Grants básicos
GRANT anon TO authenticator;
GRANT authenticated TO authenticator;
GRANT service_role TO authenticator;
GRANT supabase_auth_admin TO postgres;
GRANT supabase_storage_admin TO postgres;

-- Crear esquemas necesarios
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS extensions;

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgjwt SCHEMA extensions;

-- Grants en esquemas
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON SCHEMA storage TO supabase_storage_admin;

-- Crear buckets de storage
INSERT INTO storage.buckets (id, name, public) VALUES 
  ('school-logos', 'school-logos', true),
  ('family-photos', 'family-photos', true),
  ('school-assets', 'school-assets', true)
ON CONFLICT (id) DO NOTHING;
