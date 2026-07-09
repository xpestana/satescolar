# Inscripciones

> 🧭 Al implementar cambios de este tema, sigue las [Convenciones de desarrollo](CONVENTIONS.md)
> (código en inglés, SOLID, pruebas, formato, una responsabilidad por archivo).

## Resumen
Proceso de inscripción de estudiantes al colegio (matrícula por año escolar/sección).

## Roles involucrados
- **school** — gestiona inscripciones (permiso `enrollments.view`).
- **representative** — (según flujo) puede iniciar/completar inscripción. ⏳ verificar.

## Casos de uso
- Se inscribe a un estudiante en una **sección** para un **año escolar** concreto.
- Se registra el tipo de inscripción (nuevo ingreso / continuidad) y observaciones.
- La inscripción define la sección/grado que usarán notas y asistencias.

## Operaciones / Funciones
| Operación | Rol | Ruta | Permiso | Descripción |
|---|---|---|---|---|
| Inscripciones | school | `/inscripciones` | `enrollments.view` | Gestión de inscripciones. |

## Rutas (frontend)
- `/inscripciones`

## Endpoints / Edge Functions
> ⏳ Por documentar.

## Datos / Tablas (Supabase)
- `enrollments` — inscripción: `student_id`, `school_year_id`, `section_id`, `school_id`,
  `enrollment_type`, `enrollment_date`, `enrolled_at`, `observations`.
- Referencia: `students`, `school_years`, `sections`.

## Reglas de negocio (datos)
- Una inscripción liga estudiante ↔ año escolar ↔ sección (y por la sección, el
  `grade_level`). Es la base para notas ([09](09-notas-y-boletas.md)) y asistencias.

## Reglas de negocio
- Los campos del formulario de inscripción se configuran en
  [15](15-configuracion-colegio.md) (`/school/configuraciones/inscripcion-campos`).

## Archivos clave (código)
- `src/components/enrollments/...`

## Por documentar
- Estados de la inscripción y su relación con planillas y pagos.
