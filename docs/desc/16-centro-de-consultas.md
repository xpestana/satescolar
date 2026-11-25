# Centro de Consultas (Búsqueda avanzada + Estadística de matrícula)

> 🧭 Al implementar cambios de este tema, sigue las [Convenciones de desarrollo](CONVENTIONS.md)
> (código en inglés, SOLID, pruebas, formato, una responsabilidad por archivo).
>
> 📦 **Módulo:** Registro (gratis). Ver [19-modulos](19-modulos.md).

## Resumen
Página del colegio con **dos pestañas arriba** (antes se llamaba "Búsqueda Avanzada"):

1. **Búsqueda avanzada** — buscador transversal de estudiantes, representantes y docentes sobre
   todos los campos de sus formularios, con columnas configurables y exportación.
2. **Estadística de matrícula** — réplica del cuadro "Matrícula actualizada por edad, sexo y
   documento de identidad": inscritos por sección × edad × sexo, totales por sexo, CI/CE/Pasaporte,
   totales por grado, Media General vs Media Técnica, total general, y contadores por sexo de cada
   respuesta de los campos de selección/casilla del formulario de estudiantes.

## Roles involucrados
- **school** — acceso a la página (sin permiso específico; visible para el rol `school`).

## Casos de uso
- El colegio localiza a cualquier persona por cualquier dato del formulario y exporta el resultado.
- El colegio elige **año escolar** y **grado/año** (y opcionalmente **sección**) y obtiene el cuadro
  de matrícula por edad y sexo para entregarlo al ente rector, en pantalla, **Excel** o **PDF**.
- El colegio ve, por sexo, cuántos estudiantes respondieron cada opción de los selects/casillas
  (p. ej. "¿Usa lentes?": Sí/No por M/F).

## Operaciones / Funciones
| Operación | Rol | Ruta | Permiso | Descripción |
|---|---|---|---|---|
| Búsqueda avanzada | school | `/registros/centro-consultas?tab=busqueda` | — | Búsqueda con filtros. |
| Estadística de matrícula | school | `/registros/centro-consultas?tab=matricula` | — | Cuadro por edad/sexo/documento y respuestas por sexo. |

## Rutas (frontend)
- `/registros/centro-consultas` (pestaña en `?tab=busqueda|matricula`).
- `/registros/busqueda-avanzada` redirige a la nueva ruta (enlaces viejos).

## Endpoints / Edge Functions
Sin Edge Function. La estadística usa dos **RPC** de Postgres (`SECURITY DEFINER`, guardia
`is_school_staff(p_school_id) OR is_admin()`; evitan la RLS fila por fila):

- `get_enrollment_demographics(p_school_id, p_school_year_id)` →
  `(section_id, age, sex, document_kind, total)` agregados con `GROUP BY`.
- `get_enrollment_answer_breakdown(p_school_id, p_school_year_id)` →
  `(section_id, field_name, answer, sex, total)`.

Se llama **una vez por año escolar**; los filtros de grado/sección se aplican en el cliente sobre la
caché de React Query (cambio de filtro instantáneo).

## Datos / Tablas (Supabase)
- `students.birth_date` (`date`) y `students.sex` (enum `student_sex`: `male`/`female`): copias
  tipadas de `form_data.fecha_nacimiento` y `form_data.genero` (o `sexo`), mantenidas por el
  trigger `students_sync_demographics` en cualquier escritura. **No se editan directo.**
  Normalizadores: `parse_form_date` (ISO o `DD/MM/YYYY`; inválida → `NULL`) y
  `normalize_student_sex` (`Masculino/M/Hombre…` → `male`, `Femenino/F/Mujer…` → `female`).
- `enrollments` (año/sección) con índice `idx_enrollments_year_school (school_year_id, school_id) INCLUDE (section_id, student_id)`.
- `sections` (`grade_level`, `is_technical`) y `form_fields` (campos elegibles y sus opciones).
- Búsqueda avanzada: `students`, `representatives`, `teachers`, `families`, `form_fields`.

## Reglas de negocio (Estadística de matrícula)
- **Edad:** años cumplidos **a la fecha de hoy** (zona `America/Caracas`); se imprime como
  "Fecha de actualización". Sin fecha válida → fila **"Sin fecha"**.
- **Sexo:** M/F; sin dato → columna **"S/D"** (solo aparece si hay casos) y un aviso en pantalla.
- **Documento:** prefijo de `document_id` (o `tipo_documento`): **CI** = `V`/`E`, **CE** = `CE`,
  **Pasaporte** = `P`; sin documento → "Sin documento".
- **Bloques:** uno por sección (orden de grado, letra, técnica tras su par normal); con "Todos los
  grados" además uno por grado y subtotales por nivel; si hay Secundaria, **Total Media General** y
  **Total Media Técnica** (por `sections.is_technical`); siempre **Total**.
  Todas las tablas comparten la misma escala de edades.
- **Respuestas por sexo:** campos del formulario de estudiantes visibles de tipo `checkbox` o
  `select` con `options` fijas, excluyendo `genero`, `sexo`, `tipo_documento`, `nivel_grado`
  (los cubre el cuadro). Los selects geográficos (sin `options`, guardan UUID) quedan fuera.
  Casilla → "Sí/No"; sin responder → "Sin respuesta"; respuestas fuera de las opciones se muestran al final.
- `fecha_nacimiento` y `genero` son **campos protegidos** del formulario de estudiantes
  (obligatorios, no se pueden ocultar ni borrar). Ver [15](15-configuracion-colegio.md).

## Acciones por fila (Búsqueda avanzada)
La columna **Acciones** (fija a la izquierda de la tabla) ofrece: **Ver** (abre `ViewFamilyModal`,
o `ViewTeacherModal` en la pestaña Docentes), **Editar**, **Descargar Carnet** y, según la
pestaña activa:

- **Estudiantes** — interruptor de **bloqueo de notas y boletas** para el representante
  (`StudentGradeAccessToggle` sobre `student_grade_access`). El mismo bloqueo se opera desde la
  ficha de la familia, desde la lista de familias (ícono de candado → `FamilyGradeAccessDialog`)
  y desde `/notas/consulta` → pestaña "Visibilidad para Representantes";
  ver [09-notas](09-notas-y-boletas.md).
- **Representantes** — marcar como representante principal (`is_primary`).

## Archivos clave (código)
- `src/pages/school/ConsultationCenter.tsx` — página y pestañas.
- `src/components/search/AdvancedSearchTab.tsx` — pestaña Búsqueda avanzada.
- `src/components/enrollment-stats/` — pestaña Estadística (`EnrollmentStatsTab`, filtros,
  `ReportTableCard`, `MissingDemographicsAlert`).
- `src/hooks/useEnrollmentStatsReport.ts` (+ `useEnrollmentStatsData.ts`) — datos y modelo de vista.
- `src/lib/enrollmentStats/` — lógica pura con tests: `buildEnrollmentStats`,
  `buildAnswerBreakdown`, `choiceFields`, `reportTables` (modelo común pantalla/Excel/PDF),
  `enrollmentStatsExcel`, `enrollmentStatsPdf`.
- `src/lib/pdfSchoolBranding.ts` + `src/hooks/usePdfSchoolBranding.ts` — membrete PDF compartido.
- `supabase/migrations/20261125120000_student_demographics.sql` — columnas, trigger, índice y RPC.
- `src/components/students/StudentGradeAccessToggle.tsx` (acción de bloqueo de notas).
