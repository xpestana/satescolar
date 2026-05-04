# Gestor de Usuarios Escolares con Permisos Granulares

Crear un módulo dentro de **Ajustes del Colegio** donde el usuario `school` dueño del colegio pueda crear, editar y desactivar otros sub-usuarios escolares del mismo colegio, asignándoles **perfiles de permisos personalizables** que controlan qué áreas/acciones pueden ver y ejecutar.

---

## 1. Modelo de datos

### `permission_keys` (catálogo global, seedeado)
Lista maestra de permisos disponibles.
- `key` text PK — ej: `families.view`, `families.edit`, `grades.edit`, `payments.register`
- `module` text — agrupador UI (Familias, Notas, Pagos, Inscripciones, Ajustes…)
- `label` text — descripción legible
- `supports_scope` bool — si admite restricción por grado / año escolar

### `permission_profiles` (perfiles por colegio)
Plantillas creadas por el dueño del colegio (ej: "Coordinador Académico", "Secretaria", "Cobranzas").
- `id` uuid PK, `school_id` FK, `name`, `description`, timestamps

### `permission_profile_items`
Permisos asignados a cada perfil, con scope opcional.
- `id`, `profile_id` FK, `permission_key` FK
- `scope` jsonb — null = sin restricción; ej `{"grade_levels":["1er Grado"], "school_year_ids":["..."]}`

### `school_user_profiles`
Asignación de perfiles a cada sub-usuario.
- `user_id`, `school_id`, `profile_id` — PK compuesta

### Cambio en `user_roles`
Agregar `is_owner` boolean default false. El primer `school` por colegio = owner (todos los permisos, no editable). Sub-usuarios = `is_owner=false`.

---

## 2. RLS y seguridad

- `permission_profiles`, `permission_profile_items`, `school_user_profiles`: solo owner del colegio (o admin) puede CRUD; sub-usuarios pueden SELECT lo propio.
- Función `public.has_permission(_user_id uuid, _key text, _scope jsonb default null)` SECURITY DEFINER:
  - admin → true
  - school owner del colegio → true
  - sub-usuario con perfil que contenga el key (y scope compatible) → true
- Mutations sensibles (ej. UPDATE en `grades`) validan vía trigger que `has_permission` autorice también el scope (grado del estudiante).

---

## 3. Edge Functions

- **`create-school-subuser`** — owner envía email + nombre + perfiles → crea `auth.users` con password aleatorio, `user_roles` (role=school, is_owner=false), `school_user_profiles`, dispara welcome email (reutiliza `smtp-client` existente).
- **`update-school-subuser`** — editar nombre/perfiles.
- **`reset-school-subuser-password`** — owner regenera contraseña y reenvía credenciales.
- **`suspend-school-subuser`** — desactivar (no borrar, conserva auditoría).

Todas con `verify_jwt=false` y validación de identidad vía `auth.getClaims(token)` + chequeo de owner.

---

## 4. Frontend

### Rutas nuevas (todas `requiredRole="school"`, solo owner)
- `/school/configuraciones/usuarios` — tabs **Usuarios** / **Perfiles de Permiso**
- `/school/configuraciones/usuarios/nuevo` y `/:userId/editar`
- `/school/configuraciones/usuarios/perfiles/nuevo` y `/:profileId/editar`

### Páginas
1. **SchoolUsersList** — tabla nombre, email, perfiles, estado, acciones (editar / resetear contraseña / suspender).
2. **SchoolUserForm** — datos básicos + multi-select de perfiles.
3. **PermissionProfilesList** — listado de perfiles con conteo de usuarios.
4. **PermissionProfileForm** — checkbox tree agrupado por `module`. Para keys con `supports_scope=true` se muestra panel adicional con multi-select de grados y de años escolares (se guarda en `scope`).

### Sidebar
Agregar **"Usuarios y Permisos"** en sección **Ajustes del Colegio**, visible solo si `is_owner`.

### Hook + control de acceso
- `usePermissions()` — carga (React Query) los permission_keys efectivos del usuario con sus scopes. Owner = todos.
- `<RequirePermission permission="grades.edit" scope={{grade_level:"3er Grado"}}>` para envolver botones / secciones.
- `ProtectedRoute` extendido con `requiredPermission` opcional.
- `AppSidebar` — filtra items por permisos además de por rol.

### Catálogo inicial de permission_keys (seed)
- Familias: `families.view`, `families.edit`, `families.create`, `families.delete`
- Estudiantes: `students.view`, `students.edit`
- Docentes: `teachers.view`, `teachers.manage`
- Áreas/Materias: `subjects.view`, `subjects.manage`
- Notas: `grades.view` *(scope)*, `grades.edit` *(scope)*
- Inscripciones: `enrollments.view`, `enrollments.manage`
- Pagos: `payments.view`, `payments.register`, `payments.config`, `payments.delinquency`
- Asistencias: `attendance.scan`, `attendance.view`
- Utilidades: `emails.send`, `forms.config`, `planillas.config`
- Ajustes: `settings.school`, `settings.users` (solo owner)

---

## 5. Flujo del usuario

1. Owner entra a **Ajustes del Colegio → Usuarios y Permisos**.
2. Crea perfil "Coordinador 1er Grado" con `grades.view`+`grades.edit` scope `{grade_levels:["1er Grado"]}` y `families.view`.
3. Crea sub-usuario `coord1@colegio.com` con ese perfil → recibe email con credenciales.
4. Al iniciar sesión ve un sidebar reducido: Inicio, Familias (lectura), Notas (solo 1er grado).

---

## Notas técnicas

- Owner se determina con `user_roles.is_owner=true`; migración marca como owner al primer `user_roles` por `school_id` ya existente.
- `usePermissions` cachea con React Query; se invalida al cambiar perfil del usuario.
- RLS de tablas existentes ya filtra por `school_id`; el scope adicional (grado/año) se aplica en queries del front + validación server-side en mutations sensibles.
- Reutiliza la infraestructura de welcome emails (`smtp-client`, plantillas existentes).
- Sub-usuarios y owner comparten `role='school'` → los hooks/queries existentes siguen funcionando sin cambios estructurales.
