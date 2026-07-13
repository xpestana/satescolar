# Dashboards por rol

> 🧭 Al implementar cambios de este tema, sigue las [Convenciones de desarrollo](CONVENTIONS.md)
> (código en inglés, SOLID, pruebas, formato, una responsabilidad por archivo).

## Resumen
Panel de inicio de cada rol, con métricas y accesos rápidos según el contexto del usuario.

## Roles involucrados
- **admin**, **school**, **teacher**, **representative** — cada uno con su dashboard.

## Casos de uso
- Cada rol, al ingresar, ve su panel con métricas y accesos rápidos de su ámbito.

## Operaciones / Funciones
| Operación | Rol | Ruta | Permiso | Descripción |
|---|---|---|---|---|
| Dashboard admin | admin | `/dashboard` | admin | Panel del administrador. |
| Inicio colegio | school | `/school/dashboard` | — | Panel del colegio. |
| Inicio docente | teacher | `/teacher/dashboard` | — | Panel del docente. |
| Inicio representante | representative | `/representative/dashboard` | — | Panel del representante. |

## Rutas (frontend)
- `/dashboard`, `/school/dashboard`, `/teacher/dashboard`, `/representative/dashboard`

## Endpoints / Edge Functions
> ⏳ Por documentar (métricas por consulta directa).

## Datos / Tablas (Supabase)
> ⏳ Por documentar (métricas agregadas).

## Reglas de negocio
> ⏳ Por documentar.

## Archivos clave (código)
- `src/pages/school/SchoolDashboard.tsx`
- `src/components/dashboard/...`

## Por documentar
- Métricas/KPIs mostrados en cada dashboard.
