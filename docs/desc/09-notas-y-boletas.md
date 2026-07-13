# Notas y boletas

> 🧭 Al implementar cambios de este tema, sigue las [Convenciones de desarrollo](CONVENTIONS.md)
> (código en inglés, SOLID, pruebas, formato, una responsabilidad por archivo).

## Resumen
Carga, consulta e impresión de notas/calificaciones y generación de boletas.
El docente carga notas en el aula virtual; el colegio consulta e imprime; el admin puede
importar calificaciones de forma masiva; el representante ve las boletas de sus estudiantes.

## Roles involucrados
- **school** — consulta e impresión (permiso `grades.view`).
- **teacher** — carga de notas (vía aula virtual — ver [11](11-aula-virtual.md)).
- **admin** — importación masiva de calificaciones.
- **representative** — visualización de boletas. ⏳ verificar ruta.

## Casos de uso
- El docente carga las notas de sus áreas en el aula virtual.
- El colegio **elige/diseña el formato de la boleta** en `/formatos` → pestaña
  **"Formato de Boletas"** y luego consulta e imprime boletas con ese formato.
- El admin importa calificaciones masivamente desde archivo (incl. bachillerato).
- El representante consulta las boletas de sus estudiantes.

## Formato de la boleta (`/formatos`)
El **formato visual de la boleta se elige/configura en `/formatos`** (pestaña "Formato de
Boletas"). Es el mismo patrón que la **factura** en pagos (ver [12-pagos](12-pagos.md)):
la config guardada allí es la fuente de verdad y **debe respetarse al generar/modificar la
boleta**.

- **Niveles soportados:** se manejan boletas de **Preescolar**, **Primaria** y
  **Secundaria** (bachillerato). Cada plantilla define a qué grados aplica
  (`applicable_grades`); sin selección = aplica a todos los grados.
  - Preescolar: `pre_maternal`, `maternal`, `i_nivel`, `ii_nivel`, `iii_nivel`
  - Primaria: `1_grado` … `6_grado`
  - Secundaria: `1_ano` … `6_ano`
- **Estilos de boleta** (`config.style`):
  - `simple`
  - `boletin_completo` → "Bachillerato media hoja" (se imprime a la mitad de la hoja;
    en impresora "2 páginas por hoja").
  - `primaria_descriptivo` → "Primaria Descriptivo".
- **Papel:** Carta / Media carta / A4 / Oficio (o dimensiones mm personalizadas).
- **Activación:** cada plantilla puede activarse/desactivarse (`is_active`); la plantilla
  activa + sus `applicable_grades` determinan qué formato se usa al generar la boleta.
- **Firmas:** en `boletin_completo`/`primaria_descriptivo` se cargan firma+sello en la
  plantilla; en `simple` las líneas de firma se toman de **Planillas → Configuración General**.

> ⚠️ Regla clave: cualquier cambio en la generación/impresión de la boleta debe leer y
> respetar la configuración de `/formatos` (tabla `boleta_templates`), no valores fijos.

## Ajustes de notas (`/school/configuraciones/ajustes-notas`)
Pantalla `GradesSettings` ("Ajustes de Notas"), con una tarjeta por nivel:
**Preescolar**, **Primaria** y **Secundaria**. Por nivel se define:
- **Tipo de boleta/reporte** (`grades_config.preschool_report_type`,
  `primary_report_type`): p. ej. Preescolar → `descriptive` ("Descriptivo con
  componentes") o `indicators` ("Indicadores por componentes").
- **Escalas de calificación** (sigla + descripción):
  `preschool_grading_scales`, `primary_grading_scales`.
- **Gestión de componentes/indicadores** por nivel.
- **Plan por porcentaje** (`grades_config.use_percentage_plan`).

> El tipo de reporte elegido aquí determina qué **estilo de boleta** se genera (se enlaza
> con las plantillas de `/formatos`, ver sección anterior).

## Operaciones / Funciones
| Operación | Rol | Ruta | Permiso | Descripción |
|---|---|---|---|---|
| Notas y Boletas | school | `/notas/consulta` | `grades.view` | Consulta e impresión de notas/boletas. |
| Ajustes de notas | school | `/school/configuraciones/ajustes-notas` | `settings.school` | Escala/estructura de notas. |
| Formato de Boletas | school | `/formatos` (pestaña Boletas) | `payments.config` | Diseño/elección del formato de boleta por nivel. |
| Importar calificaciones | admin | `/admin/importar-calificaciones` | admin | Carga masiva de notas. |

## Rutas (frontend)
- `/notas/consulta`
- `/school/configuraciones/ajustes-notas`
- `/formatos` (pestaña "Formato de Boletas")
- `/admin/importar-calificaciones`

## Endpoints / Edge Functions
- `import-grades` — importación masiva de calificaciones.
- `import-bachillerato-grades` — importación específica de bachillerato.

## Datos / Tablas (Supabase)
- `boleta_templates` — plantillas de formato de boleta: `school_id`, `name`, `description`,
  `level`, `paper_width_mm`, `paper_height_mm`, `config` (JSON con `style`, secciones,
  colores, firmas…), `applicable_grades` (string[] | null), `is_active`.
- `grades_config` — config de notas por colegio: `preschool_report_type`,
  `primary_report_type`, `use_percentage_plan`, …
- `primary_grading_scales`, `preschool_grading_scales` — escalas (sigla + descripción).
- `evaluation_plan_items` — plan de evaluación por asignación: `momento` (lapso),
  `percentage`, `description`. Define las evaluaciones de un área.
- `student_grades` — nota de un estudiante en un ítem del plan:
  `student_id`, `assignment_id`, `evaluation_plan_item_id`, `grade_value`.
- `final_grades` — nota definitiva por estudiante × asignación × `momento`:
  `grade_value`, `absence_count`, `attendance_count`, `adjustment_points`, `final_status`,
  `observation`.
- **Preescolar/Primaria (por indicadores):** `preschool_indicator_components`,
  `preschool_component_indicators`, `preschool_final_indicator_grades`,
  `preschool_final_reports`; `primary_indicator_areas`, `primary_grade_indicators`,
  `primary_final_indicator_grades`, `primary_final_reports`.

> Todo cuelga de `subject_teacher_assignments` (ver [06-areas-materias](06-areas-materias.md)):
> el plan de evaluación y las notas referencian el `assignment_id`.

## Reglas de negocio
- **El formato de boleta se define en `/formatos` (tabla `boleta_templates`) y la
  generación/impresión debe respetarlo** — mismo patrón que la factura en pagos.
- Se soportan 3 niveles: Preescolar, Primaria, Secundaria (por `applicable_grades`).
- Estilo de impresión "media hoja" (`boletin_completo`): cada boleta ocupa la mitad de la
  hoja elegida; imprimir con "2 páginas por hoja".
- Plantillas/render de boleta: `src/lib/bachilleratoTemplate.ts`,
  `src/lib/bachilleratoBoleta.ts`, `src/lib/primaryDescriptiveBoleta.ts`.

## Archivos clave (código)
- `src/pages/school/GradesConsultation.tsx`
- `src/pages/school/FormatsConfig.tsx` (contenedor de pestañas Facturas/Boletas)
- `src/components/grades/BolletasFormatTab.tsx` (editor de formato de boleta)
- `src/lib/bachilleratoTemplate.ts`, `src/lib/bachilleratoBoleta.ts`,
  `src/lib/primaryDescriptiveBoleta.ts`, `src/lib/export-utils.ts`

## Por documentar
- Estructura de notas (períodos, lapsos, promedios) y esquema completo de `config`.
- Cómo `/notas/consulta` selecciona la plantilla activa por grado al imprimir.
