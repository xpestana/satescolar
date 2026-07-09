# Áreas / materias y su asignación

> 🧭 Al implementar cambios de este tema, sigue las [Convenciones de desarrollo](CONVENTIONS.md)
> (código en inglés, SOLID, pruebas, formato, una responsabilidad por archivo).

## Resumen
Definición de las áreas (materias) del colegio y su asignación a docentes/secciones.
El docente ve las áreas que tiene asignadas.

## Roles involucrados
- **school** — define áreas (`subjects.view`) y las asigna (`subjects.manage`).
- **teacher** — ve sus áreas asignadas.

## Casos de uso
- El colegio crea sus áreas/materias y define cómo se evalúan y muestran.
- El colegio asigna un área a un docente para una sección y año escolar concretos.
- El docente ve las áreas que tiene asignadas y trabaja sobre ellas.

## Concepto central: la "asignación" (`subject_teacher_assignments`)
La tabla **`subject_teacher_assignments`** es el **eje del sistema académico**: representa
la tupla **docente × área × sección × año escolar**. Casi todo lo académico cuelga de ella:
plan de evaluación, notas, aula virtual y (parcialmente) asistencias referencian el
`assignment_id`. Verlo así ayuda a entender [09-notas](09-notas-y-boletas.md),
[11-aula-virtual](11-aula-virtual.md) y [10-asistencias](10-asistencias.md).

## Operaciones / Funciones
| Operación | Rol | Ruta | Permiso | Descripción |
|---|---|---|---|---|
| Áreas | school | `/registros/areas` | `subjects.view` | ABM de áreas/materias. |
| Asignación de áreas | school | `/registros/asignacion-areas` | `subjects.manage` | Asignar áreas a docentes/secciones. |
| Mis áreas | teacher | `/teacher/materias` | — | Áreas asignadas al docente. |

## Rutas (frontend)
- `/registros/areas`
- `/registros/asignacion-areas`
- `/teacher/materias`

## Endpoints / Edge Functions
- CRUD directo a tablas vía RLS (sin Edge Function propia).

## Datos / Tablas (Supabase)
- `school_subjects` — áreas/materias del colegio: `name`, `abbreviation`, `subject_type`,
  `evaluation_type`, `display_order`, `show_in_planilla`, `show_in_report_card`,
  `is_suspended`.
- `subject_teacher_assignments` — asignación **docente × área × sección × año**:
  `teacher_id`, `subject_id`, `section_id` (nullable), `school_year_id`, `is_suspended`.
- `evaluation_plan_items` — plan de evaluación por asignación: `momento` (lapso),
  `percentage`, `description`, `display_order` (ver [09](09-notas-y-boletas.md)).
- `gcrp_assignment_students` — estudiantes vinculados a una asignación (grupos/GCRP).

## Reglas de negocio
- Un área puede ocultarse en planilla y/o boletín (`show_in_planilla`,
  `show_in_report_card`) y suspenderse sin borrarla (`is_suspended`).
- La asignación siempre está acotada a un **año escolar**; al cambiar de año se crean
  asignaciones nuevas.
- `evaluation_type` / `subject_type` definen cómo se evalúa/clasifica el área.

## Archivos clave (código)
- `src/pages/school/...` (Áreas y Asignación de Áreas) — ⏳ confirmar nombres exactos.
- `src/pages/teacher/...` (Mis áreas).

## Por documentar
- Valores posibles de `subject_type` y `evaluation_type`.
- UI exacta de asignación y su relación con `gcrp_assignment_students`.
