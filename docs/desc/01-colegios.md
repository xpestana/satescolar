# Colegios (alta y gestión global)

> 🧭 Al implementar cambios de este tema, sigue las [Convenciones de desarrollo](CONVENTIONS.md)
> (código en inglés, SOLID, pruebas, formato, una responsabilidad por archivo).

## Resumen
Gestión de los colegios (tenants) de la plataforma por parte del administrador SAT.

## Roles involucrados
- **admin** — crea y administra colegios.
- **school** — opera dentro de su propio colegio (configuración en [15](15-configuracion-colegio.md)).

## Casos de uso
> ⏳ Por documentar.

## Operaciones / Funciones
| Operación | Rol | Ruta | Permiso | Descripción |
|---|---|---|---|---|
| Listar/gestionar colegios | admin | `/admin/colegios` | admin | ABM de colegios. |

## Rutas (frontend)
- `/admin/colegios`

## Endpoints / Edge Functions
> ⏳ Por documentar (¿alta de colegio por función o por tabla directa?).

## Datos / Tablas (Supabase)
> ⏳ Por documentar (tabla `schools` / campos).

## Reglas de negocio
> ⏳ Por documentar.

## Archivos clave (código)
> ⏳ Por documentar (`src/pages/admin/...`).

## Por documentar
- Estructura de datos del colegio y multi-tenant.
