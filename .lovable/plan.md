

# Plan: Módulo Aula Virtual — Implementación por Fases

Este es un módulo de gran escala (~15-20 tablas nuevas, ~30+ pantallas, ~10+ componentes complejos). Se implementará en **5 fases incrementales**, cada una entregando funcionalidad usable.

---

## Fase 1: Fundación — Base de datos, configuración de aula y vista de materias del docente

### Tablas nuevas (migración SQL)

```text
classroom_config          — personalización del aula por assignment (portada, color, descripción, normas, bienvenida)
classroom_topics          — temas/unidades creados por el docente dentro de una materia
classroom_posts           — publicaciones del muro (anuncios, tipo: announcement/material/assignment/question)
classroom_post_attachments — archivos adjuntos a publicaciones
classroom_activities      — tareas, cuestionarios, materiales (tipo: task/quiz/forum/material/link/video/document)
classroom_activity_attachments — archivos adjuntos a actividades
classroom_submissions     — entregas de alumnos
classroom_submission_attachments — archivos adjuntos a entregas
classroom_comments        — comentarios en posts y actividades (públicos y privados)
classroom_rubrics         — rúbricas por actividad
classroom_rubric_criteria — criterios de la rúbrica con niveles y puntaje
classroom_events          — eventos del calendario del aula
classroom_access_codes    — código anual + QR por alumno por año escolar
classroom_access_log      — bitácora de accesos del representante
classroom_notifications   — notificaciones internas del módulo
```

### Relaciones clave con tablas existentes

- `classroom_config.assignment_id` → `subject_teacher_assignments.id` (1:1)
- `classroom_activities.evaluation_plan_item_id` → `evaluation_plan_items.id` (vinculación con notas)
- `classroom_submissions.student_id` → `students.id`
- `classroom_access_codes.student_id` → `students.id`, `.school_year_id` → `school_years.id`
- Todas las tablas llevan `school_id` para RLS multi-tenant

### RLS Policies

- Docente: CRUD en config/topics/posts/activities de sus assignments
- Alumno: SELECT en posts/activities de sus enrollments, INSERT en submissions/comments
- Representante: SELECT filtrado por student_id de sus hijos (via families → students)
- School/Admin: SELECT/UPDATE completo por school_id

### Pantallas (Fase 1)

1. **Docente: Lista de Aulas** (`/teacher/aula-virtual`) — tarjetas tipo Classroom por materia asignada
2. **Docente: Configuración del Aula** — modal/página para portada, color, descripción, normas
3. **Docente: Gestión de Temas** — crear/editar/reordenar/ocultar temas dentro de una materia

### Storage

- Nuevo bucket `classroom-files` (público) para archivos adjuntos

### Navegación

- Agregar "Aula Virtual" al sidebar del docente
- Nueva ruta `/teacher/aula-virtual`
- Nueva ruta `/teacher/aula-virtual/:assignmentId`

---

## Fase 2: Muro (Stream) y Trabajo de Clase

### Pantallas

4. **Muro/Stream** — vista tipo feed con anuncios, publicaciones fijadas, adjuntos
5. **Trabajo de Clase** — listado organizado por temas con tipos de contenido
6. **Crear/Editar Actividad** — formulario completo (título, descripción, instrucciones, fecha entrega, puntaje, adjuntos, tema, rúbrica, vinculación con plan de evaluación, programación/borrador)
7. **Crear/Editar Publicación** — anuncios con adjuntos, comentarios habilitables, programación

### Funcionalidades

- Publicación inmediata, borrador y programación
- Fijar publicaciones
- Habilitar/deshabilitar comentarios por publicación
- Adjuntar archivos, enlaces, videos
- Vincular actividad evaluada con `evaluation_plan_items` existente (momento + porcentaje)

---

## Fase 3: Entregas, Calificación y Rúbricas

### Pantallas

8. **Vista del Alumno: Mis Materias** (`/student/aula-virtual`) — tarjetas de materias activas
9. **Vista del Alumno: Detalle Materia** — muro, trabajo, calendario, entregas
10. **Entrega de Actividad** — subir archivos, texto, enlaces, reemplazar antes del vencimiento
11. **Docente: Revisar Entregas** — listado con filtros por estado, calificar, devolver con observaciones
12. **Docente: Vista Individual del Alumno** — resumen completo por materia
13. **Rúbricas** — creación por actividad, vista previa para alumno, calificación con rúbrica

### Estados de entrega

`pending` | `submitted` | `submitted_late` | `reviewed` | `graded` | `expired` | `not_submitted`

### Integración con Notas

- Al calificar una actividad vinculada a `evaluation_plan_item_id`, se puede reflejar opcionalmente en `student_grades`

---

## Fase 4: Acceso del Representante, Códigos QR y Seguridad

### Pantallas

14. **Representante: Botón "Aula Virtual" por hijo** en dashboard existente
15. **Representante: Vista del Aula del Hijo** — materias, muro filtrado, calendario, tareas, entregas, pendientes, vencidas
16. **Validación de Código de Acceso** — pantalla intermedia que pide código anual antes de entrar
17. **Admin/School: Gestión de Códigos** — regenerar códigos, ver bitácora de accesos

### Seguridad

- `classroom_access_codes`: código UUID único por alumno + año escolar, auto-generado
- QR que codifica URL + token (no da acceso directo sin validación)
- Control de intentos fallidos (max 5, bloqueo temporal)
- Bitácora en `classroom_access_log`
- Expiración al cambiar de año escolar
- Representante NUNCA ve datos de otros alumnos (RLS estricto por student → family → user)

### Configuración institucional

- El school define qué ve el representante (calificaciones sí/no, observaciones docente sí/no)

---

## Fase 5: Calendario, Notificaciones y Supervisión Escolar

### Pantallas

18. **Calendario del Aula** — vista mensual/semanal alimentada por `evaluation_plan_items` + `classroom_activities` + `classroom_events`
19. **Panel de Notificaciones** — nueva tarea, tarea por vencer, calificación disponible, comentario del docente
20. **School: Supervisión de Aulas** — listado de todas las aulas activas, auditoría
21. **School: Configuración del Módulo** — permisos globales, visibilidad representante, políticas institucionales
22. **Archivado de Aula** — archivar por periodo, reutilizar publicaciones

### Notificaciones

- Tabla `classroom_notifications` con tipo, destinatario, leído/no leído
- Opcional: integración con edge function `send-email` existente para notificaciones por correo

---

## Modelo de datos resumido

```text
subject_teacher_assignments (existente)
  └── classroom_config (1:1)
  └── classroom_topics (1:N)
  └── classroom_posts (1:N)
       └── classroom_post_attachments (1:N)
       └── classroom_comments (1:N)
  └── classroom_activities (1:N)
       └── classroom_activity_attachments (1:N)
       └── classroom_submissions (1:N por alumno)
            └── classroom_submission_attachments (1:N)
       └── classroom_rubrics (1:1)
            └── classroom_rubric_criteria (1:N)
       └── classroom_comments (1:N)
  └── classroom_events (1:N)

students (existente)
  └── classroom_access_codes (1:N por año escolar)

classroom_access_log (bitácora plana)
classroom_notifications (notificaciones)
```

---

## Archivos principales a crear

| Ruta | Descripción |
|------|-------------|
| `src/pages/teacher/ClassroomList.tsx` | Lista de aulas del docente |
| `src/pages/teacher/ClassroomDetail.tsx` | Detalle del aula con tabs (Muro, Trabajo, Calendario, Personas) |
| `src/components/classroom/StreamFeed.tsx` | Muro/Stream |
| `src/components/classroom/ClassworkList.tsx` | Trabajo de clase organizado por temas |
| `src/components/classroom/ActivityForm.tsx` | Crear/editar actividad |
| `src/components/classroom/SubmissionReview.tsx` | Revisar entregas |
| `src/components/classroom/RubricEditor.tsx` | Editor de rúbricas |
| `src/components/classroom/ClassroomCalendar.tsx` | Calendario |
| `src/components/classroom/TopicsManager.tsx` | Gestión de temas |
| `src/components/classroom/ClassroomConfig.tsx` | Configuración del aula |
| `src/pages/representative/ChildClassroom.tsx` | Vista del representante por hijo |
| `src/components/classroom/AccessCodeGate.tsx` | Validación de código de acceso |
| `src/hooks/useClassroomData.ts` | Hook principal de datos del aula |

---

## Primera acción al aprobar

1. Corregir los 7 errores de build existentes en edge functions (tipos `unknown` y `null` checks)
2. Crear migración con las primeras 6 tablas (config, topics, posts, attachments, comments, activities)
3. Crear bucket `classroom-files`
4. Implementar `ClassroomList.tsx` y `ClassroomConfig.tsx` con rutas y sidebar
5. Implementar `TopicsManager.tsx`

Esto entrega en la Fase 1 la base funcional: el docente entra, ve sus materias como aulas, configura cada una y organiza temas.

