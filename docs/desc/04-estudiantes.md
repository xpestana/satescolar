# Estudiantes

> 🧭 Al implementar cambios de este tema, sigue las [Convenciones de desarrollo](CONVENTIONS.md)
> (código en inglés, SOLID, pruebas, formato, una responsabilidad por archivo).

## Resumen
Gestión de los estudiantes: alta, datos y relación con la familia. El representante ve
sus estudiantes; el colegio los gestiona a través de familias, inscripciones y notas.

## Roles involucrados
- **representative** — ve sus estudiantes.
- **school** — gestiona estudiantes (vía familias / inscripciones).

## Casos de uso
> ⏳ Por documentar.

## Operaciones / Funciones
| Operación | Rol | Ruta | Permiso | Descripción |
|---|---|---|---|---|
| Mis estudiantes | representative | `/representative/estudiantes` | — | Estudiantes de la familia. |

## Rutas (frontend)
- `/representative/estudiantes`

## Endpoints / Edge Functions
> ⏳ Por documentar (probablemente gestionados vía `create-family` / importación).

## Datos / Tablas (Supabase)
- `students` — `family_id`, `document_id`, `photo_url`, `status` (enum `student_status`),
  **`form_data` (JSON)** con los campos dinámicos definidos por el Formulario de
  estudiantes (ver [15](15-configuracion-colegio.md)).
- Vínculos: `enrollments` (año/sección, ver [07](07-inscripciones.md)),
  `student_schools`/`student_concept_balances`/`student_payment_plans`
  (ver [12-pagos](12-pagos.md)).

## Reglas de negocio
> ⏳ Por documentar.

## Archivos clave (código)
- `src/pages/representative/StudentsList.tsx`

## Configuración relacionada
- El **formulario de estudiantes** se edita en Formularios
  (`/school/configuraciones/formularios/estudiantes`) — ver [15-configuracion-colegio](15-configuracion-colegio.md).

## Por documentar
- Ciclo de vida del estudiante (inscripción → año escolar → sección → notas).
