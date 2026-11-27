# Autenticación, roles y control de acceso

> 🧭 Al implementar cambios de este tema, sigue las [Convenciones de desarrollo](CONVENTIONS.md)
> (código en inglés, SOLID, pruebas, formato, una responsabilidad por archivo).

## Resumen
Sistema de login y determinación del rol del usuario (`admin`, `school`, `teacher`,
`representative`). El rol define qué secciones del sidebar y qué rutas ve el usuario.
Para el rol `school` existe además un sistema de **permisos granulares** por perfil.

## Roles involucrados
- **admin** — acceso total a la administración de la plataforma.
- **school** — owner (acceso total) o sub-usuario con permisos por perfil.
- **teacher** — acceso a su ámbito académico.
- **representative** — acceso a su familia.

## Casos de uso
- Un usuario inicia sesión y el sistema resuelve su `userRole` y lo lleva a su dashboard.
- Un admin **impersona** a un usuario para soporte/diagnóstico.
- Un sub-usuario `school` solo ve las secciones para las que su perfil tiene permiso.

## Operaciones / Funciones
| Operación | Rol | Ruta | Permiso | Descripción |
|---|---|---|---|---|
| Iniciar sesión | todos | `/` (auth) | — | Login y resolución de `userRole`. |
| Proteger rutas | todos | — | por `requiredRole` | `ProtectedRoute` valida rol. |
| Resolver permisos | school | — | — | `usePermissions` carga owner + perfiles. |

## Rutas (frontend)
> ⏳ Por documentar (rutas de login/recuperación).

## Endpoints / Edge Functions
- `impersonate-user` — genera sesión como otro usuario (soporte).
- `update-user-password` — cambio de contraseña.
- `get-user-emails` — resuelve emails de usuarios.
- `delete-user`, `suspend-user` — baja/suspensión de cuentas.

## Datos / Tablas (Supabase)
- `user_roles` (`user_id`, `role`, `school_id`, `is_owner`)
- `school_user_profiles` (`user_id`, `profile_id`)
- `permission_profile_items` (`profile_id`, `permission_key`, `scope`)

## Reglas de negocio
- El sidebar filtra por `requiredRole` (sección) y por `permission` (ítem) — ver `AppSidebar.tsx`.
- Un `school` **owner** ve todo; un sub-usuario solo ve ítems cuyos `permission_key` tenga.
- Los permisos admiten **scope** por `grade_levels` y `school_year_ids` (`hasInScope`).

- Además de rol y permisos, cada sección pertenece a un **módulo** que debe estar activo en el
  colegio (aplica también al owner). Ver [19-modulos](19-modulos.md).

## Aislamiento por rol en la base de datos (RLS)
**Todos** los roles tienen fila en `user_roles` con el `school_id` del colegio: el personal
(`school`), los docentes (`teacher`) y los representantes (`representative`). Por eso
"tener fila en `user_roles` del colegio" **no** identifica al personal.

> ⚠️ Regla: una política "del colegio" nunca debe usar
> `EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = X.school_id)`
> sin filtrar el rol. Usa los helpers (todos `STABLE SECURITY DEFINER`):
>
> | Helper | Quién pasa |
> |---|---|
> | `is_school_staff(school_id)` | personal del colegio: `user_roles.role = 'school'` (dueño y sub-usuarios) |
> | `is_school_teacher(school_id)` | docente del colegio (`teachers.user_id`) |
> | `is_school_staff_or_teacher(school_id)` | cualquiera de los dos (lecturas que usa el portal docente) |
> | `is_school_family(school_id)` | representante de una familia del colegio |
> | `teaches_my_children(teacher_id)` | el docente da clase a un hijo del representante |
> | `teacher_can_view_student(student_id)` | el estudiante es del colegio del docente |

> 🐞 Corregido (migración `20261006130000_restrict_school_policies_to_staff.sql`): 147 políticas
> "School users …" y las funciones `user_shares_school`, `user_has_school_access_to_family` y
> `user_has_school_access_to_student` aceptaban cualquier fila de `user_roles`. Un representante
> podía, desde la API, leer y modificar notas, pagos, saldos, nómina y familias de **todo** su
> colegio; también podía desbloquearse las notas (`student_grade_access`) o publicar momentos
> (`grade_visibility_settings`). Un docente podía editar estudiantes y pagos. Ahora:
> - Las políticas "School users …" exigen `is_school_staff`. El dueño y los sub-usuarios ven y
>   escriben exactamente lo mismo que antes; se verificó tabla por tabla, con las mismas cifras.
> - Los docentes conservan las **lecturas** que usa su portal: estudiantes, inscripciones,
>   asignaciones, docentes del colegio, configuración de notas y plantillas y firmas de boleta.
>   **Escriben** solo en sus asignaciones, con las políticas "Teachers can …".
> - Los representantes ven y escriben solo lo de su familia. Además leen tres catálogos del
>   colegio: tasas, grupos del formulario y métodos de pago activos. También leen las áreas y los
>   docentes de las asignaturas de sus hijos.
>
> Al agregar una pantalla de docente o representante que consulte una tabla nueva, revisa que esa
> tabla tenga una política **propia** para ese rol. Ya no se cuela por la del personal.

## Contexto del usuario (`get_my_context`) y caché
Todo lo que la app necesita saber del usuario antes de dibujar una pantalla llega en **una sola**
petición: `rpc get_my_context()` devuelve `role`, `role_school_id` (`user_roles.school_id`),
`school_id` (el colegio según el rol: personal, docente vía `teachers`, representante vía
`families` → `family_schools`), `is_owner`, `teacher_id`, `family_id`, los `modules` del colegio y
los `permissions` de un sub-usuario. Antes eran 5–7 consultas encadenadas (~3 s).

- `SECURITY INVOKER`: cada tabla se lee con el RLS de quien llama (lo mismo que leían las consultas
  sueltas). Solo `authenticated` puede ejecutarla (se revoca a `anon`).
- Rol, docente y familia se resuelven **solo si hay exactamente una fila**, igual que los
  `maybeSingle()`/`single()` que reemplaza: con duplicados el usuario queda sin rol/colegio, en vez
  de que una fila creada por otro (el personal puede insertar `teachers`/`families`) decida qué
  colegio ve.
- `AuthProvider` (`src/hooks/useAuth.tsx`) expone `context` y `refreshContext`. Lo guarda en
  `localStorage` (`satescolar:user-context:v1`, una sola entrada, atada al `userId`;
  `src/lib/userContext.ts`): al recargar pinta al instante con lo guardado y revalida en segundo
  plano. Se borra al cerrar sesión, y otro usuario (impersonación) nunca lee la entrada de otro.
  **Solo decide qué se muestra**: los datos siguen protegidos por RLS.
- Se vuelve a pedir al regresar a la pestaña tras `SESSION_CHECK_INTERVAL_MS` (mismo oyente que
  `useServerSessionCheck`), por si cambiaron módulos o permisos.
- `useSchoolId`, `useCurrentSchoolId`, `useSchoolModules` y `usePermissions` leen del contexto (sin
  consultas propias); `useRepresentativeFamily` y `useSchoolData` piden sus detalles en paralelo.
- Panel de cada rol: `roleHomePath` (`src/lib/roleHome.ts`), usado por Login, `ProtectedRoute`,
  `ModuleGate` y la impersonación. Id del usuario para columnas de auditoría: `getCurrentUserId`
  (`src/lib/currentUser.ts`, lee la sesión local; la validez la comprueba `verifyServerSession`).

## Cierre de sesión e impersonación
- `signOut` usa **`scope: 'local'`**: cierra solo la sesión de **este navegador**. supabase-js
  usa `global` por defecto, que borra **todas** las sesiones del usuario en el servidor.
- La impersonación (`impersonate-user`) reemplaza la sesión del admin por una sesión real del
  usuario impersonado (magic link + `verifyOtp`). Al "Cerrar sesión" desde ahí, se cierra esa
  sesión, no la del usuario.

> 🐞 Corregido: con `signOut()` global, cuando el admin terminaba una impersonación se borraban
> en el servidor las sesiones reales del cliente. Su navegador seguía con un access token que
> PostgREST acepta hasta que vence (las listas cargan), pero `auth.getUser(token)` en las Edge
> Functions falla porque la sesión ya no existe. Síntomas: en *Usuarios y Permisos* nombre y
> correo en "—", toast **"No autorizado"** y no se pueden crear sub-usuarios. Dura como mucho lo
> que vive el access token (`jwt_exp` = 1 h); después el refresh falla y el usuario vuelve al login.
> (Que `login_count` no subiera era otro problema: ver *Perfil y contador de ingresos*.)
>
> Protección adicional (`src/lib/sessionGuard.ts` + `src/hooks/useServerSessionCheck.ts`):
> - Al cargar la app y al volver a la pestaña (máx. cada 5 min) se confirma la sesión con
>   `supabase.auth.getUser()`. Si Auth dice que fue revocada (`session_not_found`, 401/403…),
>   se limpia **localmente** y el usuario va al login. Un fallo de red **no** cierra sesión.
> - `invokeEdgeFunction`: ante un **401** verifica la sesión; si fue revocada muestra
>   *"Tu sesión se cerró o venció. Vuelve a iniciar sesión para continuar."*
>
> ⚠️ Regla: no llamar `supabase.auth.signOut()` sin `scope`. Para Edge Functions nuevas, usar
> `invokeEdgeFunction` en lugar de `supabase.functions.invoke` y no tragarse los errores.
>
> Nota: cada impersonación pasa por `verifyOtp`, que actualiza `last_sign_in_at`, así que
> **suma** un ingreso al `login_count` del usuario impersonado.

## Perfil (`profiles`) y contador de ingresos
Cada usuario de `auth.users` tiene **una** fila en `public.profiles` (`full_name`, `phone`,
`login_count`, `last_login_at`). La usan la lista de usuarios del admin (actividad, nombre), el
panel del admin (conteo de usuarios) y las funciones de administradores.

Dos triggers sobre `auth.users` la mantienen (migración `20261123200000_profiles_created_on_signup.sql`):

| Trigger | Cuándo | Qué hace |
|---|---|---|
| `on_auth_user_created` → `handle_new_user()` | al crear el usuario (cualquier vía) | crea la fila con `full_name` de `user_metadata` |
| `on_auth_user_updated` → `sync_profile_from_auth()` | al cambiar `last_sign_in_at` o `user_metadata.full_name` | **upsert**: suma 1 a `login_count`, guarda `last_login_at` y sincroniza el nombre |

- `last_sign_in_at` cambia en cada inicio de sesión real (contraseña, magic link, impersonación),
  no al refrescar el token: un usuario que deja la pestaña abierta días no suma ingresos.
- Ambas funciones atrapan sus errores (`RAISE WARNING`): un problema en `profiles` **nunca** debe
  impedir un alta o un login.
- El nombre visible sale de `user_metadata.full_name`; las Edge Functions solo actualizan la
  metadata y el trigger copia el nombre a `profiles`.

> 🐞 Corregido: al mover el proyecto (~2026-06-02) se copiaron el esquema `public` y el historial de
> migraciones, pero **no** los triggers de `auth.users`. `on_auth_user_created` figuraba como
> aplicado pero no existía, así que 210 de 236 usuarios no tenían perfil y el contador (un `UPDATE`
> simple) no contaba nada: todos aparecían con 0 ingresos y el panel del admin mostraba 26 usuarios.
> Se recreó el trigger, el contador pasó a upsert y se rellenaron los perfiles faltantes (con
> `login_count` = 1 si el usuario había entrado alguna vez; el historial anterior no existe).
>
> ⚠️ Regla: tras restaurar o mover la base, verificar que existan los dos triggers:
> `select tgname from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal;`
> Nunca actualizar `profiles` con `update` desde una Edge Function: usar `upsert` con
> `onConflict: "user_id"`.

## Archivos clave (código)
- `src/hooks/useAuth.tsx`
- `src/hooks/usePermissions.ts`
- `src/hooks/useServerSessionCheck.ts`, `src/lib/sessionGuard.ts`
- `src/lib/invokeEdgeFunction.ts`
- `src/components/auth/ProtectedRoute.tsx`
- `src/components/layout/AppSidebar.tsx`

## Por documentar
- Flujo de registro/invitación de cada rol.
- Lista canónica de todos los `permission_key`.
