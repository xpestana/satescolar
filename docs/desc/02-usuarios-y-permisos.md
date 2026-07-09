# Usuarios, administradores y permisos

> 🧭 Al implementar cambios de este tema, sigue las [Convenciones de desarrollo](CONVENTIONS.md)
> (código en inglés, SOLID, pruebas, formato, una responsabilidad por archivo).

## Resumen
Gestión de usuarios de la plataforma. A nivel `admin` se administran usuarios y
administradores globales. A nivel `school` se gestionan sub-usuarios y **perfiles de
permisos** granulares.

## Roles involucrados
- **admin** — usuarios y administradores globales.
- **school** — sub-usuarios y perfiles de permisos (permiso `settings.users`).

## Casos de uso
- El admin crea un administrador SAT o un usuario del sistema.
- El colegio (owner) crea un sub-usuario y le asigna un perfil de permisos.
- Se suspende o elimina una cuenta de usuario.

## Operaciones / Funciones
| Operación | Rol | Ruta | Permiso | Descripción |
|---|---|---|---|---|
| Usuarios (global) | admin | `/admin/usuarios` | admin | ABM de usuarios de la plataforma. |
| Administradores | admin | `/admin/administradores` | admin | ABM de administradores SAT. |
| Usuarios y Permisos | school | `/school/configuraciones/usuarios` | `settings.users` | Sub-usuarios y perfiles de permisos. |

## Rutas (frontend)
- `/admin/usuarios`
- `/admin/administradores`
- `/school/configuraciones/usuarios`

## Endpoints / Edge Functions
- `create-admin-user`, `create-system-admin`, `update-system-admin` — administradores.
- `manage-school-subuser` — alta/edición de sub-usuarios del colegio.
- `delete-user`, `suspend-user`, `update-user-password` — gestión de cuentas.
- `get-user-emails`, `impersonate-user` — utilidades de soporte.

## Datos / Tablas (Supabase)
- `user_roles`, `school_user_profiles`, `permission_profile_items`
- `permission_profiles` (perfiles) — ⏳ verificar nombre.

## Reglas de negocio
- Un `school` **owner** no requiere permisos; ve todo.
- Los perfiles agrupan `permission_key` con `scope` opcional (grado / año escolar).

## Archivos clave (código)
- `src/pages/admin/UsersList.tsx`, `src/pages/admin/AdminUsersList.tsx`
- `src/pages/school/SchoolUsersList.tsx`, `src/pages/school/SchoolUserForm.tsx`
- `src/pages/school/PermissionProfileForm.tsx`

## Permisos del área de Pagos (referencia)
Además de `payments.*` (ver [12-pagos](12-pagos.md)), el submódulo de **Nómina** agrega al
catálogo (module "Pagos") las claves: `payroll.view`, `payroll.register`, `payroll.approve`
(segregación elabora/aprueba) y `payroll.config`.

## Por documentar
- Catálogo completo de `permission_key` y a qué ítem del menú corresponde cada uno.
