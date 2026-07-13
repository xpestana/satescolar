# Asistencias (QR, registro, dashboard)

> 🧭 Al implementar cambios de este tema, sigue las [Convenciones de desarrollo](CONVENTIONS.md)
> (código en inglés, SOLID, pruebas, formato, una responsabilidad por archivo).

## Resumen
Registro y consulta de asistencia de estudiantes, con escaneo por código QR (carnet),
registro manual y dashboard analítico. El docente registra asistencia de sus áreas/aulas.

## Roles involucrados
- **school** — escáner QR, registro y dashboard (permisos `attendance.scan`, `attendance.view`).
- **teacher** — asistencias de sus áreas.

## Casos de uso
- Se escanea el QR del carnet de un estudiante y queda registrada su asistencia.
- El colegio consulta el registro y el dashboard de asistencia.
- El docente marca asistencia de su área/aula.

## Operaciones / Funciones
| Operación | Rol | Ruta | Permiso | Descripción |
|---|---|---|---|---|
| Escáner QR | school | `/utilidades/escaner-qr` | `attendance.scan` | Escaneo de carnet para marcar asistencia. |
| Registro de asistencias | school | `/utilidades/asistencias` | `attendance.view` | Listado/registro manual. |
| Dashboard asistencia | school | `/utilidades/asistencias-dashboard` | `attendance.view` | Analítica de asistencia. |
| Asistencias docente | teacher | `/teacher/asistencias` | — | Asistencia por área/aula. |
| Escaneo (público) | — | `/attendance/scan` (`AttendanceScan`) | ⏳ | Punto de escaneo. ⏳ verificar. |

## Rutas (frontend)
- `/utilidades/escaner-qr`
- `/utilidades/asistencias`
- `/utilidades/asistencias-dashboard`
- `/teacher/asistencias`

## Endpoints / Edge Functions
- `record-attendance` — registra el marcaje de asistencia (desde el escáner).

## Datos / Tablas (Supabase)
- `attendance_records` — marcaje de asistencia. Es **polimórfico**: `entity_type` +
  `entity_id` (estudiante o docente). Campos: `attendance_date`, `attendance_time`,
  `attendance_timestamp`, `status`, `record_type`, `momento`, `section_id`, `subject_id`,
  `token_id`, `notification_email`, `notification_sent`.
- `attendance_tokens` — token del QR: `token`, `entity_type`, `entity_id`, `is_active`.
  Cada carnet lleva su token; el escaneo lo resuelve a la entidad.

## Reglas de negocio
- El QR del carnet contiene un `attendance_tokens.token` que identifica a la entidad
  (estudiante/docente) — ver [14-carnet](14-carnet.md).
- El marcaje puede notificar por correo (`notification_email` / `notification_sent`).
- La asistencia puede asociarse a `section_id`/`subject_id`/`momento`, enlazando con el
  ámbito académico (ver [06-areas-materias](06-areas-materias.md)).
- La escritura del registro pasa por la Edge Function `record-attendance`.

## Archivos clave (código)
- `src/pages/school/AttendanceScanner.tsx`
- `src/pages/AttendanceScan.tsx`
- `src/components/attendance/...`

## Por documentar
- Formato del contenido del QR y anti-duplicado de marcaje.
