## Objetivo

En `/admin/usuarios` actualmente solo se listan usuarios con rol `school`. Vamos a mostrar **todos** los usuarios no-admin (school, teacher, representative/family) de **todos los colegios**, y hacer que el botón "Iniciar sesión" (LogIn) funcione para los tres roles, redirigiendo a su dashboard correspondiente y respetando su colegio.

## Cambios

### 1. Edge Function `impersonate-user`
Hoy solo acepta usuarios con rol `school` y lo bloquea si no lo es. Vamos a:
- Permitir impersonar cualquier rol **excepto `admin`** (seguridad: un admin nunca puede suplantar a otro admin desde aquí).
- Devolver el `role` del usuario suplantado en la respuesta, para que el frontend sepa a qué dashboard redirigir.

### 2. Página `src/pages/admin/UsersList.tsx`
- **Carga de datos**: en vez de filtrar `user_roles` por `role = 'school'`, traer todas las filas con `role IN ('school','teacher','representative')`.
- **Resolver nombre del colegio según el rol**:
  - `school`: ya viene en `user_roles.school_id` → join a `schools`.
  - `teacher`: buscar en `teachers` por `user_id` → `school_id` → nombre del colegio.
  - `representative` (family): buscar en `families` por `user_id` → tabla puente `family_schools` → colegios asociados (puede ser más de uno; mostraremos los nombres separados por coma).
- **Nueva columna "Rol"** (badge) para distinguir Colegio / Docente / Representante.
- Mantener email/suspensión vía `get-user-emails`.
- **Botón LogIn**: tras llamar `impersonate-user`, usar el `role` devuelto para redirigir:
  - `school` → `/school/dashboard`
  - `teacher` → `/teacher/dashboard`
  - `representative` → `/representative/dashboard`
- **Editar / Crear**: el modal actual está pensado solo para usuarios "school" (asignar un colegio). Lo dejamos así: el botón "Agregar Usuario" sigue creando solo cuentas de colegio (la creación de docentes y familias ya tiene sus propios módulos en cada colegio). El botón **Editar** se ocultará para teacher/representative en esta lista (su edición vive en sus módulos respectivos); seguirán visibles los botones **Iniciar sesión**, **Suspender** y **Eliminar**.

### 3. Detalles técnicos
- Para teachers: `select id, user_id, school_id, schools(name) from teachers where user_id in (...)`.
- Para families: `select id, user_id from families where user_id in (...)` y luego `select family_id, schools(name) from family_schools where family_id in (...)`.
- Reutilizamos `get-user-emails` para emails y estado de suspensión.
- En `impersonate-user`: cambiar la verificación `role = 'school'` a `role != 'admin'`, e incluir `role` en el JSON de respuesta.

## Resultado

La lista en `/admin/usuarios` mostrará todos los usuarios funcionales del sistema agrupados por colegio y rol, y el admin podrá entrar con un clic a la cuenta de cualquiera (school, docente o representante) llegando al dashboard correcto de su rol y colegio.
