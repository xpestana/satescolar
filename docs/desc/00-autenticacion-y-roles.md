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
> correo en "—", toast **"No autorizado"**, no se pueden crear sub-usuarios, y
> `profiles.login_count` no sube porque el cliente nunca vuelve a iniciar sesión de verdad.
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
