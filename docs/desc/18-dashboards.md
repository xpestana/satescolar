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
### Pendientes por Atender (`/school/dashboard`)
Tarjeta `PendingItemsCard`; la lista la arma `buildPendingItems` (`src/lib/dashboardPendingItems.ts`)
con los conteos de `useDashboardPendingItems`. Orden y reglas:

| Aviso | Cuándo aparece | Enlace |
|---|---|---|
| No hay un año escolar activo configurado | ningún `school_years.is_active` | `/school/configuraciones/anos-secciones` |
| Falta agregar las secciones del colegio | 0 filas en `sections` del colegio | `/school/configuraciones/anos-secciones` |
| Falta registrar las familias del colegio | 0 filas en `family_schools` del colegio | `/registros/familias` |
| Alumnos registrados sin inscripción en el año activo | estudiantes activos sin `enrollments` en el año activo | `/inscripciones` |
| Docentes activos sin áreas asignadas en el año activo | solo con módulos docentes | `/registros/asignacion-areas` |
| Áreas curriculares sin docente asignado | solo con módulos docentes | `/registros/asignacion-areas` |

Los tres primeros son de configuración inicial y van arriba. Si alguna consulta falla, la
tarjeta muestra un error en vez de "No hay pendientes".

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
- `src/components/dashboard/...` (incluye `PendingItemsCard.tsx`)
- `src/hooks/useDashboardPendingItems.ts`, `src/lib/dashboardPendingItems.ts`

## Por documentar
- Métricas/KPIs de los dashboards admin, colegio y docente.
