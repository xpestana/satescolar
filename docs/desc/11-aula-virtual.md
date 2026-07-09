# Aula virtual y supervisión

> 🧭 Al implementar cambios de este tema, sigue las [Convenciones de desarrollo](CONVENTIONS.md)
> (código en inglés, SOLID, pruebas, formato, una responsabilidad por archivo).

## Resumen
Espacio del docente para gestionar su aula: contenidos, comentarios/reacciones, carga de
notas y actividad. El colegio puede **supervisar** las aulas.

## Roles involucrados
- **teacher** — opera su aula virtual.
- **school** — supervisa aulas (permiso `classroom.supervise`).

## Casos de uso
- El docente configura su aula (portada, colores, reglas, permisos de estudiantes).
- El docente publica anuncios/materiales y crea actividades evaluadas.
- Los estudiantes entregan actividades, comentan y reaccionan.
- El colegio supervisa las aulas de sus docentes.

## Operaciones / Funciones
| Operación | Rol | Ruta | Permiso | Descripción |
|---|---|---|---|---|
| Aula virtual | teacher | `/teacher/aula-virtual` | — | Gestión del aula del docente. |
| Supervisión aulas | school | `/school/aula-virtual/supervision` | `classroom.supervise` | Supervisión de aulas. |

## Rutas (frontend)
- `/teacher/aula-virtual`
- `/school/aula-virtual/supervision`

## Endpoints / Edge Functions
- CRUD directo a tablas vía RLS. Acceso de estudiantes por código
  (`classroom_access_codes`); adjuntos suben a S3 (`s3-sign-upload`).

## Datos / Tablas (Supabase)
Todas las tablas cuelgan de una **asignación** (`assignment_id`, ver
[06-areas-materias](06-areas-materias.md)) = el "aula" de un docente para un área/sección:
- `classroom_config` — config del aula: `color`, `cover_url`, `rules`,
  `welcome_message`, `allow_student_posts`, `allow_student_comments`, `is_archived`.
- `classroom_topics` — temas/unidades para organizar el contenido.
- `classroom_posts` — publicaciones/anuncios (`post_type`, `is_pinned`, `status`).
- `classroom_activities` — actividades evaluables: `activity_type`, `due_date`,
  `max_score`, `allow_late_submission`, `allow_resubmission`,
  `evaluation_plan_item_id` (enlaza la actividad con una nota — ver [09](09-notas-y-boletas.md)).
- `classroom_submissions` (+ `classroom_submission_attachments`) — entregas de estudiantes.
- `classroom_comments`, `classroom_reactions` — interacción.
- `classroom_rubrics`, `classroom_rubric_criteria` — rúbricas de evaluación.
- `classroom_post_attachments`, `classroom_activity_attachments` — adjuntos.
- `classroom_access_codes`, `classroom_access_log` — acceso de estudiantes al aula.
- `classroom_notifications`, `classroom_events` — avisos y bitácora.

## Reglas de negocio
- Un aula = una **asignación** (docente × área × sección × año).
- Una actividad puede vincularse a un ítem del plan de evaluación
  (`evaluation_plan_item_id`), de modo que la nota de la actividad alimenta las notas.
- La participación de estudiantes (posts/comentarios) se habilita en `classroom_config`.

## Archivos clave (código)
- `src/components/classroom/CommentsAndReactions.tsx`
- `src/components/classroom/...`

## Por documentar
- Modelo de contenidos del aula y relación con notas/asistencias.
