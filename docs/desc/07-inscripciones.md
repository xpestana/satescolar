# Inscripciones

> 🧭 Al implementar cambios de este tema, sigue las [Convenciones de desarrollo](CONVENTIONS.md)
> (código en inglés, SOLID, pruebas, formato, una responsabilidad por archivo).

## Resumen
Proceso de inscripción de estudiantes al colegio (matrícula por año escolar/sección).

## Roles involucrados
- **school** — gestiona inscripciones y descarga planillas (permiso `enrollments.view`).
- **representative** — edita datos de sus estudiantes y puede descargar la planilla de
  inscripción desde Mis Estudiantes.

## Casos de uso
- Se inscribe a un estudiante en una **sección** para un **año escolar** concreto.
- Se registra el tipo de inscripción (nuevo ingreso / continuidad) y observaciones.
- La inscripción define la sección/grado que usarán notas y asistencias.
- El colegio o el representante descargan la **planilla de inscripción** en PDF para un
  estudiante (ver [08-planillas](08-planillas.md)).

## Operaciones / Funciones
| Operación | Rol | Ruta | Permiso | Descripción |
|---|---|---|---|---|
| Inscripciones | school | `/inscripciones` | `enrollments.view` | Gestión de inscripciones, exportación y descarga de planilla. |
| Descargar planilla | representative | `/representative/estudiantes` | — | Planilla de inscripción desde menú Descargas. |

## Rutas (frontend)
- `/inscripciones` (school)
- `/representative/estudiantes` (representative — descarga de planilla)

## Endpoints / Edge Functions
> CRUD directo a tablas vía Supabase/RLS. La planilla se genera en el cliente con
> `downloadPlanillaInscripcion` (`src/lib/export-utils.ts`).

## Datos / Tablas (Supabase)
- `enrollments` — inscripción: `student_id`, `school_year_id`, `section_id`, `school_id`,
  `enrollment_type`, `enrollment_date`, `enrolled_at`, `observations`.
- Referencia: `students`, `school_years`, `sections`.
- Planilla: `enrollment_planilla_sections`, `planilla_general_config`,
  `planilla_signature_blocks` (ver [08-planillas](08-planillas.md)).

## Reglas de negocio (datos)
- Una inscripción liga estudiante ↔ año escolar ↔ sección (y por la sección, el
  `grade_level`). Es la base para notas ([09](09-notas-y-boletas.md)) y asistencias.

## Reglas de negocio
- Los campos del formulario de inscripción se configuran en
  [15](15-configuracion-colegio.md) (`/school/configuraciones/inscripcion-campos`).
- **Modal de inscripción:** al inscribir un estudiante, se validan solo los campos
  **required** del formulario (`form_fields` + `isEffectivelyRequired` en
  `EnrollStudentModal`). No se exigen todos los campos de la planilla.
- **Descarga de planilla (school y representative):** no bloquea por campos opcionales
  de la planilla. Se genera el PDF con los datos existentes; los vacíos aparecen como
  `"No registrado"`. El representante usa el mismo `downloadPlanillaInscripcion` que school
  (sin validación de completitud); su planilla sale **idéntica** gracias a las políticas RLS
  de lectura sobre `enrollment_planilla_sections`, `planilla_general_config`,
  `planilla_signature_blocks` y `form_fields` (ver [08-planillas](08-planillas.md)).
- **Lista de inscripciones (school):** `checkStudentCompleteness` compara los campos
  configurados en `enrollment_planilla_sections` solo para **colorear filas**
  (verde/ámbar/rojo), no para impedir la descarga.

## Archivos clave (código)
- `src/pages/school/EnrollmentsList.tsx` — gestión, exportación y descarga (school).
- `src/pages/representative/StudentsList.tsx` — descarga de planilla (representative).
- `src/components/enrollments/EnrollStudentModal.tsx` — inscripción y validación required.
- `src/lib/export-utils.ts` — `downloadPlanillaInscripcion`.
- `src/lib/enrollment-completeness.ts` — completitud visual en lista school.

## Por documentar
- Estados de la inscripción y su relación con pagos.
