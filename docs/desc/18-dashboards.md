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
### Dashboard del representante (`/representative/dashboard`)
- **Título `Familia [apellidos]`:** usa `useRepresentativeFamily().familyName`, con la cadena
  de respaldo apellidos de la familia → representante principal → estudiante → `"Mi Familia"`
  (ver [03-familias-y-representantes](03-familias-y-representantes.md)).
- **Representantes / Estudiantes:** total de filas de `representatives` / `students` de la
  familia (sin filtrar por año escolar).
- **Inscritos en plantel:** cuenta de `enrollments` de los estudiantes de la familia en el
  **año escolar activo** (`school_years.is_active`) y el colegio de la familia
  (`family_schools.school_id`). Sin año activo o sin estudiantes, muestra `0`.
- **Aviso de morosidad:** `get_delinquent_balances_for_family` para la familia, colegio y
  año escolar activo — ver [12-pagos](12-pagos.md).

## Archivos clave (código)
- `src/pages/school/SchoolDashboard.tsx`
- `src/pages/representative/RepresentativeDashboard.tsx`
- `src/hooks/useRepresentativeFamily.ts`
- `src/lib/familyDisplayName.ts`
- `src/components/dashboard/...`

## Por documentar
- Métricas/KPIs de los dashboards admin, colegio y docente.
