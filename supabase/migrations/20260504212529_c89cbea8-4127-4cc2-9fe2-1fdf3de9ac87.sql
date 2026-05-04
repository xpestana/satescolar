
-- 1. is_owner en user_roles
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS is_owner boolean NOT NULL DEFAULT false;

-- Marcar dueño = primer school user_role por colegio
WITH first_per_school AS (
  SELECT DISTINCT ON (school_id) id
  FROM public.user_roles
  WHERE role = 'school' AND school_id IS NOT NULL
  ORDER BY school_id, created_at ASC
)
UPDATE public.user_roles ur
SET is_owner = true
FROM first_per_school f
WHERE ur.id = f.id;

-- 2. Catálogo global permission_keys
CREATE TABLE public.permission_keys (
  key text PRIMARY KEY,
  module text NOT NULL,
  label text NOT NULL,
  supports_scope boolean NOT NULL DEFAULT false,
  display_order int NOT NULL DEFAULT 0
);
ALTER TABLE public.permission_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permission keys readable by authenticated"
  ON public.permission_keys FOR SELECT TO authenticated USING (true);

INSERT INTO public.permission_keys (key, module, label, supports_scope, display_order) VALUES
  ('families.view','Familias','Ver familias',false,10),
  ('families.create','Familias','Crear familias',false,11),
  ('families.edit','Familias','Editar familias',false,12),
  ('families.delete','Familias','Eliminar familias',false,13),
  ('students.view','Estudiantes','Ver estudiantes',false,20),
  ('students.edit','Estudiantes','Editar estudiantes',false,21),
  ('teachers.view','Docentes','Ver docentes',false,30),
  ('teachers.manage','Docentes','Gestionar docentes',false,31),
  ('subjects.view','Áreas y Materias','Ver áreas',false,40),
  ('subjects.manage','Áreas y Materias','Gestionar áreas y asignaciones',false,41),
  ('grades.view','Notas y Boletas','Ver notas',true,50),
  ('grades.edit','Notas y Boletas','Editar notas',true,51),
  ('grades.reports','Notas y Boletas','Generar boletas',true,52),
  ('enrollments.view','Inscripciones','Ver inscripciones',false,60),
  ('enrollments.manage','Inscripciones','Gestionar inscripciones',false,61),
  ('payments.view','Pagos','Ver pagos y dashboard',false,70),
  ('payments.register','Pagos','Registrar pagos',false,71),
  ('payments.config','Pagos','Configurar pagos',false,72),
  ('payments.delinquency','Pagos','Gestionar morosidad',false,73),
  ('attendance.scan','Asistencias','Escanear QR',false,80),
  ('attendance.view','Asistencias','Ver asistencias',false,81),
  ('emails.send','Utilidades','Enviar correos',false,90),
  ('forms.config','Utilidades','Configurar formularios',false,91),
  ('planillas.config','Utilidades','Configurar planillas',false,92),
  ('classroom.supervise','Aulas Virtuales','Supervisar aulas',false,100),
  ('settings.school','Ajustes','Configurar colegio (años, notas, carnet)',false,110),
  ('settings.users','Ajustes','Gestionar usuarios y permisos',false,111);

-- 3. Perfiles de permisos por colegio
CREATE TABLE public.permission_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);
CREATE INDEX idx_permission_profiles_school ON public.permission_profiles(school_id);
ALTER TABLE public.permission_profiles ENABLE ROW LEVEL SECURITY;

-- 4. Items del perfil
CREATE TABLE public.permission_profile_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.permission_profiles(id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES public.permission_keys(key) ON DELETE CASCADE,
  scope jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, permission_key)
);
CREATE INDEX idx_perm_items_profile ON public.permission_profile_items(profile_id);
ALTER TABLE public.permission_profile_items ENABLE ROW LEVEL SECURITY;

-- 5. Asignación de perfiles a sub-usuarios
CREATE TABLE public.school_user_profiles (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.permission_profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, school_id, profile_id)
);
CREATE INDEX idx_sup_user ON public.school_user_profiles(user_id, school_id);
ALTER TABLE public.school_user_profiles ENABLE ROW LEVEL SECURITY;

-- 6. Helpers
CREATE OR REPLACE FUNCTION public.is_school_owner(_user_id uuid, _school_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND school_id = _school_id
      AND role = 'school' AND is_owner = true
  );
$$;

CREATE OR REPLACE FUNCTION public.user_school_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT school_id FROM public.user_roles
  WHERE user_id = _user_id AND role = 'school' LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.has_role(_user_id, 'admin')
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = 'school' AND is_owner = true
    )
    OR EXISTS (
      SELECT 1
      FROM public.school_user_profiles sup
      JOIN public.permission_profile_items pi ON pi.profile_id = sup.profile_id
      WHERE sup.user_id = _user_id AND pi.permission_key = _key
    );
$$;

-- 7. RLS policies
-- permission_profiles
CREATE POLICY "Owners manage profiles in their school"
  ON public.permission_profiles FOR ALL TO authenticated
  USING (public.is_school_owner(auth.uid(), school_id) OR public.is_admin())
  WITH CHECK (public.is_school_owner(auth.uid(), school_id) OR public.is_admin());

CREATE POLICY "School users can read profiles of their school"
  ON public.permission_profiles FOR SELECT TO authenticated
  USING (public.user_shares_school(auth.uid(), school_id));

-- permission_profile_items
CREATE POLICY "Owners manage profile items"
  ON public.permission_profile_items FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.permission_profiles p
    WHERE p.id = profile_id AND (public.is_school_owner(auth.uid(), p.school_id) OR public.is_admin())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.permission_profiles p
    WHERE p.id = profile_id AND (public.is_school_owner(auth.uid(), p.school_id) OR public.is_admin())
  ));

CREATE POLICY "School users can read profile items of their school"
  ON public.permission_profile_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.permission_profiles p
    WHERE p.id = profile_id AND public.user_shares_school(auth.uid(), p.school_id)
  ));

-- school_user_profiles
CREATE POLICY "Owners manage user-profile assignments"
  ON public.school_user_profiles FOR ALL TO authenticated
  USING (public.is_school_owner(auth.uid(), school_id) OR public.is_admin())
  WITH CHECK (public.is_school_owner(auth.uid(), school_id) OR public.is_admin());

CREATE POLICY "Users can read own assignments"
  ON public.school_user_profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- updated_at trigger
CREATE TRIGGER trg_perm_profiles_updated
  BEFORE UPDATE ON public.permission_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
