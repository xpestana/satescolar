# Docentes

> 🧭 Al implementar cambios de este tema, sigue las [Convenciones de desarrollo](CONVENTIONS.md)
> (código en inglés, SOLID, pruebas, formato, una responsabilidad por archivo).

## Resumen
Gestión de los docentes del colegio y su ámbito de trabajo (áreas, aulas, asistencias).

## Roles involucrados
- **school** — administra docentes (permiso `teachers.view`).
- **teacher** — accede a su propio ámbito académico.

## Casos de uso
- El colegio da de alta un docente y le crea sus credenciales de acceso.
- Se restablece la contraseña de un docente.

## Operaciones / Funciones
| Operación | Rol | Ruta | Permiso | Descripción |
|---|---|---|---|---|
| Listar docentes | school | `/registros/docentes` | `teachers.view` | Padrón de docentes. |
| Alta de docente | school | (form) | `teachers.view` | Crear docente. |
| Inicio docente | teacher | `/teacher/dashboard` | — | Panel del docente. |

## Rutas (frontend)
- `/registros/docentes`
- `/teacher/dashboard`

## Endpoints / Edge Functions
- `create-teacher` — alta de docente + credenciales.
- `update-teacher-password` — cambio de contraseña del docente.

## Datos / Tablas (Supabase)
- `teachers` — `school_id`, `user_id` (nullable), `document_id`, `email`, `phone`,
  `photo_url`, `is_suspended`, **`form_data` (JSON)** (campos del Formulario de docentes,
  ver [15](15-configuracion-colegio.md)).
- `subject_teacher_assignments` — asignaciones del docente (docente × área × sección ×
  año), eje de su trabajo académico (ver [06-areas-materias](06-areas-materias.md)).

## Reglas de negocio
> ⏳ Por documentar.

## Archivos clave (código)
- `src/pages/school/TeachersList.tsx`, `src/pages/school/AddTeacher.tsx`
- `src/components/teacher/...`

## Relación con Nómina
Los docentes se **reutilizan como beneficiarios** del módulo de Nómina (categoría "Docente"):
`payroll_beneficiaries.teacher_id` referencia `teachers.id` para no duplicar sus datos.
Ver [12-pagos](12-pagos.md) → sección **Nómina (Pagos de Nóminas)**.

## Configuración relacionada
- El **formulario de docentes** se edita en Formularios
  (`/school/configuraciones/formularios/docentes`) — ver [15-configuracion-colegio](15-configuracion-colegio.md).

## Por documentar
- Relación docente ↔ áreas ↔ aulas.
