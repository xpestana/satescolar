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

## Archivos clave (código)
- `src/hooks/useAuth.tsx`
- `src/hooks/usePermissions.ts`
- `src/components/auth/ProtectedRoute.tsx`
- `src/components/layout/AppSidebar.tsx`

## Por documentar
- Flujo de registro/invitación de cada rol.
- Lista canónica de todos los `permission_key`.
