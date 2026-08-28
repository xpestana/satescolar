# Notas y boletas

> 🧭 Al implementar cambios de este tema, sigue las [Convenciones de desarrollo](CONVENTIONS.md)
> (código en inglés, SOLID, pruebas, formato, una responsabilidad por archivo).

## Resumen
Carga, consulta e impresión de notas/calificaciones y generación de boletas.
El docente carga notas en el aula virtual; el colegio consulta e imprime; el admin puede
importar calificaciones de forma masiva; el representante ve las boletas de sus estudiantes.

## Roles involucrados
- **school** — consulta e impresión (permiso `grades.view`).
- **teacher** — carga de notas (vía aula virtual — ver [11](11-aula-virtual.md)) y su propia
  firma de boleta.
- **admin** — importación masiva de calificaciones.
- **representative** — consulta de notas y descarga de boletas de sus representados en
  `/representative/estudiante/:studentId/notas` (ver *Notas y boletas del representante*).

> `/notas/consulta` es **solo del rol `school`**: `ProtectedRoute requiredRole="school"`
> (`App.tsx:174`) redirige al docente a `/teacher/dashboard`. El equivalente del docente es
> `/teacher/materias/:assignmentId/notas` (`TeacherGrades` → `TeacherReportCard`), que reutiliza
> los mismos modales de informe. **`grades.view` no protege la ruta**: solo oculta el ítem del
> menú (`AppSidebar.tsx`), así que un sub-usuario school sin el permiso entra escribiendo la URL.

## Casos de uso
- El docente carga las notas de sus áreas en el aula virtual.
- El colegio **elige/diseña el formato de la boleta** en `/formatos` → pestaña
  **"Formato de Boletas"** y luego consulta e imprime boletas con ese formato.
- El admin importa calificaciones masivamente desde archivo (incl. bachillerato).
- El representante consulta las notas y descarga las boletas de sus representados.
- El colegio decide qué momentos ve el representante y puede bloquear a un estudiante concreto.

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
  - La **cédula es opcional** en todos los casos: si va vacía no se imprime esa línea.
  - En `primaria_descriptivo` cada una de las (hasta 3) firmas tiene su propio interruptor
    (`config.primaria.signatures[].enabled`): apagarla la excluye de la boleta sin borrar sus
    datos. `enabled` ausente = activa (configs guardados antes de existir el campo).
    `boletin_completo` ignora `enabled` e imprime todas sus firmas.

> ⚠️ Regla clave: cualquier cambio en la generación/impresión de la boleta debe leer y
> respetar la configuración de `/formatos` (tabla `boleta_templates`), no valores fijos.

### Cómo se elige la plantilla activa al imprimir
Los generadores traen **todas** las plantillas activas del colegio y eligen en cliente con
`pickBoletaTemplate` (`src/lib/boletaTemplateSelection.ts`, un solo sitio; antes estaba copiado
en los 5 generadores):

1. Filtran las candidatas — **primaria por `config.style === "primaria_descriptivo"`**;
   **bachillerato por `.eq("level", "bachillerato")`**.
2. Buscan la primera cuyo `applicable_grades` **incluya el grado** del estudiante.
3. Si no hay, usan la primera **sin `applicable_grades`** (o con el array vacío) = comodín.
4. Si tampoco hay, `null` → se cae a `DEFAULT_BACHILLERATO_CONFIG`.

> ⚠️ Dos trampas conocidas:
> - **El editor guarda siempre `level: "bachillerato"`** (`BolletasFormatTab.tsx`, en el `payload`
>   del `saveMut`), sea cual sea el estilo. Por eso primaria **no puede** filtrar por `level` y lo
>   hace por `config.style`. No filtres por `level` en código de primaria.
> - **Activar una plantilla no desactiva las demás**: `is_active` no es excluyente, de ahí que la
>   query devuelva un array y el desempate se haga en cliente con las reglas de arriba.

El `config` se fusiona sobre `DEFAULT_BACHILLERATO_CONFIG` con un **merge de un solo nivel**
(`{...DEFAULT, ...tpl.config, sections: {...}, primaria: {...}}`). Ojo: `DEFAULT_BACHILLERATO_CONFIG`
**no define la clave `primaria`**, así que sus defaults se escriben a mano en cada sitio que la
fusiona — hoy `primaryDescriptiveBoleta.ts`, `PrimaryFinalReportModal.tsx` y `BolletasFormatTab.tsx`
(`PRIMARIA_DEFAULTS`).

### Esquema de `config` (`BachilleratoConfig`, en `bachilleratoTemplate.ts`)
- `style` — `simple` | `boletin_completo` | `primaria_descriptivo`.
- `sections` — interruptores de bloque: `header`, `title`, `student_info`, `grades_table`,
  `summary`, `signatures`. **Compartidos por los 3 estilos.**
- `header`, `title`, `student`, `table`, `summary` — colores, tamaños y opciones del estilo `simple`.
- `boletin?` — solo `boletin_completo`: `mention`, colores de tabla, `signatures[]`, márgenes
  (`margin_top/bottom/sides`), `title_size` y el espaciado de firmas (`sig_gap_above`,
  `sig_gap_below`, `sig_image_height`, `sig_sello_height`, `sig_pin_bottom`).
- `primaria?` — solo `primaria_descriptivo`: logo de pie (`show_footer_logo`, `footer_logo_url`,
  `footer_logo_position`), márgenes, tipografía (`name_font_size`, `sub_font_size`,
  `body_font_size`), colores (`accent_color`, `title_color`), campos opcionales de cabecera
  (`show_address`, `show_dea_code`, `show_phone`, `show_slogan`, `slogan`) y `signatures[]`.
  **No tiene los controles `sig_*`**: las alturas de firma/sello están fijas (52px / 36px) en
  `generatePrimaryDescriptiveHtml`.
- `BoletinSignature` = `nombre`, `cedula`, `cargo`, `firma_url`, `sello_url`, `enabled?`.

## Notas y boletas (`/notas/consulta`)
Pantalla `GradesConsultation`. Filtros comunes arriba: **Año Escolar → Área → Sección** (o
**Docente** si el área es GCRP) **→ Momento** (1/2/3). Tres pestañas:

1. **Consulta de Notas del Docente** — lectura del plan de evaluación y sus notas.
2. **Notas Finales y Construcción de Boletas** (`FinalGradesTab`) — se fija la nota definitiva por
   estudiante × momento y, en primaria/preescolar, se redacta el informe descriptivo
   (`PrimaryFinalReportModal` / `PreschoolFinalReportModal`, con vista previa en vivo del PDF).
   En primaria descriptivo aquí también se edita la **firma del docente** del área.
3. **Descarga de Boletas** — genera el PDF. Preescolar está "Próximamente".

> Las funciones `download*Boleta` **no descargan**: devuelven el HTML de la boleta. `GradesConsultation`
> lo pasa por `openBoletaPreview` → `htmlToPdfBlob` (html2canvas + jsPDF) → lo muestra en un
> `<iframe>` dentro de un modal, y la descarga real la hace el botón del modal. Por eso **toda
> imagen debe ir inlineada como data URL**: html2canvas no dibuja URLs cross-origin.

El **Momento** seleccionado define qué periodos entran en la boleta (Momento 1 = solo el primero;
Momento 2 = primero y segundo; Momento 3 = los tres). **Definitiva Final** es el boletín completo
del año escolar.

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

## Firma del docente en la boleta
Además de las firmas institucionales de `/formatos`, **cada docente tiene una firma propia** que se
imprime en las boletas que él redacta (solo `primaria_descriptivo`). Es **una firma por docente**,
reutilizada en todas sus boletas, con los mismos 5 campos que las de `/formatos` más un
interruptor `is_active`.

- **Dónde se edita** (componente `TeacherSignatureCard`, la misma tarjeta en ambos sitios):
  - **school** → `/notas/consulta` → pestaña "Notas Finales y Construcción de Boletas"; edita la
    firma del docente del área seleccionada (`assignment.teacher_id`).
  - **teacher** → `/teacher/materias/:assignmentId/notas`; edita la suya (`useTeacherData`).
- **Precarga** la primera vez desde el registro del docente: **nombre** desde `teachers.form_data`
  (`nombre`/`primer_nombre` + `apellido`/`primer_apellido`), **cédula** desde
  `teachers.document_id`. El **cargo queda vacío: no existe en el esquema de `teachers`**.
- **Qué docente firma una boleta:** el de la asignación con **`is_main_report`** de esa sección —
  no el de cada área. Las boletas de una misma sección comparten firmante.
- **Por qué tabla aparte y no columnas en `teachers`:** el docente no tiene `UPDATE` sobre
  `teachers` (solo hay políticas de admin y de school), y dárselo le abriría también `form_data`
  e `is_suspended`. `teacher_signatures` permite una RLS acotada a la firma.

## Notas y boletas del representante (`/representative/estudiante/:studentId/notas`)
Pantalla `StudentGrades`, a la que se entra desde el botón **"Notas y Boletas"** de la card de
cada estudiante (`representative/StudentsList.tsx` y la card reducida del dashboard).

- **Selector de año escolar** — reutiliza `useSchoolYearSelection` + `SchoolYearSelect`: arranca
  en el año `is_active` y permite consultar años anteriores o posteriores (avisa en ámbar cuando
  el año elegido no es el activo).
- **Selector de momento** — Momento 1 / 2 / 3 / **Definitiva Final** (`momento = 0`).
- **Notas** — `StudentGradesPanel`, tres variantes según `resolveGradeLevelKind` del grado de la
  sección: tabla numérica (secundaria), informe descriptivo + literal por área (primaria) e
  informe (preescolar).
- **Boleta** — `StudentBoletaDownload` llama a **los mismos generadores del colegio**
  (`downloadBachilleratoBoleta`, `downloadBachilleratoBoletaDefinitiva`,
  `downloadPrimaryDescriptiveBoleta`) y pasa el HTML por `htmlToPdfBlob` → vista previa en
  `<iframe>` + botón de descarga. Así la boleta del representante respeta el formato de
  `/formatos` sin duplicar reglas. En primaria la Definitiva Final es `momento: 3`.
- **Preescolar** — se muestran las notas pero **no** hay descarga: el generador todavía no existe
  (igual que la pestaña del colegio, que dice "Próximamente").
- **Ayuda al representante** — panel colapsable que explica qué es un momento, la definitiva, el
  literal de primaria y por qué un momento puede no verse.

## Visibilidad para representantes (control del colegio)
Cuarta pestaña de `/notas/consulta`, **"Visibilidad para Representantes"**
(`RepresentativeVisibilityTab`, visible con `grades.edit` o siendo owner). Dos bloques:

1. **Publicación por momento** — un interruptor por momento (1, 2, 3 y Definitiva Final) sobre el
   año escolar seleccionado en los filtros de la página → tabla `grade_visibility_settings`.
   **Sin fila = oculto**: la publicación es opt-in, ningún colegio empieza mostrando notas.
2. **Bloqueo por estudiante** — interruptor por alumno de la sección seleccionada →
   tabla `student_grade_access`. El bloqueo aplica a todos los años y momentos.

El mismo bloqueo por estudiante se opera desde **la ficha de la familia**
(`ViewFamilyModal`, junto al estado del estudiante) y desde **Búsqueda Avanzada**
(`AdvancedSearch`, columna Acciones, solo en la pestaña Estudiantes). Los tres puntos comparten
el componente `StudentGradeAccessToggle` y el hook `useStudentGradeBlock`.

### El gate se aplica en RLS, no en la UI
Los generadores de boleta son **cliente puro** (consultan Supabase desde el navegador), así que
ocultar en la UI no serviría de nada: un representante podría leer las tablas desde la consola.
Por eso el permiso se resuelve en la base de datos:

```
representative_grades_gate(student_id, school_year_id, momento) →
  'not_child' | 'blocked_by_school' | 'delinquent' | 'hidden_by_school' | 'ok'
```

en ese orden de precedencia. `representative_can_view_grades()` (booleano) es lo que usan las
políticas `SELECT` de `final_grades`, `primary_final_reports`, `preschool_final_reports` y las
dos tablas de indicadores; `representative_has_grades_access_in_school()` cubre las tablas que no
cuelgan de un alumno (`boleta_templates`, `school_subjects`, `teacher_signatures`, escalas e
indicadores). La UI llama al gate (`useStudentGradesAccess`) **solo para explicar el motivo**
(`src/lib/gradesAccess.ts`).

> ⚠️ **Morosidad**: si el estudiante tiene alguna cuota vencida se bloquean **notas y boleta**
> (decisión de producto), y el aviso enlaza a `/representative/pagos`. La comprobación es
> `student_has_overdue_balance()`, una versión **STABLE** de `_moroso_balance_lines` con las mismas
> reglas de vencimiento y días de gracia (`delinquency_config.overdue_after_day`) pero **sin**
> `rebuild_student_concept_balances_for_active_year()`, que es VOLATILE y no puede usarse en RLS.
> Ver [12-pagos](12-pagos.md).

## Operaciones / Funciones
| Operación | Rol | Ruta | Permiso | Descripción |
|---|---|---|---|---|
| Notas y Boletas | school | `/notas/consulta` | `grades.view` (solo menú) | Consulta e impresión de notas/boletas. |
| Notas de un área | teacher | `/teacher/materias/:assignmentId/notas` | rol `teacher` | Carga de notas e informes + su firma. |
| Ajustes de notas | school | `/school/configuraciones/ajustes-notas` | `settings.school` | Escala/estructura de notas. |
| Formato de Boletas | school | `/formatos` (pestaña Boletas) | `payments.config` | Diseño/elección del formato de boleta por nivel. |
| Importar calificaciones | admin | `/admin/importar-calificaciones` | admin | Carga masiva de notas. |
| Notas y boletas de mi representado | representative | `/representative/estudiante/:studentId/notas` | — | Consulta de notas y descarga de boleta. |
| Visibilidad para representantes | school | `/notas/consulta` (pestaña) | `grades.edit` (solo UI) | Publicar/ocultar momentos y bloquear estudiantes. |

## Rutas (frontend)
- `/notas/consulta` (solo `school`)
- `/teacher/materias/:assignmentId/notas` (solo `teacher`)
- `/school/configuraciones/ajustes-notas`
- `/formatos` (pestaña "Formato de Boletas")
- `/admin/importar-calificaciones`
- `/representative/estudiante/:studentId/notas` (solo `representative`)

## Endpoints / Edge Functions
- `import-grades` — importación masiva de calificaciones.
- `import-bachillerato-grades` — importación específica de bachillerato.

### Funciones SQL (gate del representante)
Definidas en `supabase/migrations/20260828120000_representative_grades_access.sql`, todas
`STABLE SECURITY DEFINER` y con `EXECUTE` solo para `authenticated`:
- `representative_grades_gate(student_id, school_year_id, momento) → text` — el motivo.
- `representative_can_view_grades(...) → boolean` — lo que usan las políticas por alumno.
- `representative_has_grades_access_in_school(school_id) → boolean` — tablas no ligadas a alumno.
- `student_has_overdue_balance(student_id, school_id, school_year_id) → boolean`.

La política de `subject_teacher_assignments` reutiliza `representative_child_in_assignment()`,
que ya existía para el aula virtual.

## Datos / Tablas (Supabase)
- `boleta_templates` — plantillas de formato de boleta: `school_id`, `name`, `description`,
  `level`, `paper_width_mm`, `paper_height_mm`, `config` (JSON con `style`, secciones,
  colores, firmas…), `applicable_grades` (string[] | null), `is_active`.
- `teacher_signatures` — firma propia de cada docente (1 fila por docente, PK `teacher_id`):
  `school_id`, `nombre`, `cedula`, `cargo`, `firma_url`, `sello_url`, `is_active`. La edita el
  propio docente (RLS por `teachers.user_id = auth.uid()`) o el colegio. Se imprime en la boleta
  de `primaria_descriptivo`.
- `grade_visibility_settings` — qué momentos ve el representante: `school_id`, `school_year_id`,
  `momento` (0 = Definitiva Final, 1–3), `is_visible`. **UNIQUE(school_id, school_year_id,
  momento)**; sin fila = oculto.
- `student_grade_access` — bloqueo por estudiante (PK `student_id`): `school_id`, `is_blocked`,
  `reason`. **Tabla aparte y no una columna en `students` a propósito**: el representante tiene
  `UPDATE` sobre `students` sin `WITH CHECK` ni restricción de columnas, así que podría
  desbloquearse solo. Su RLS le da al representante **solo `SELECT`**.
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
- **Firmas de la boleta de `primaria_descriptivo`:** se componen en
  `primaryDescriptiveBoleta.ts` como *firma del docente + firmas activas de `/formatos`*, en esa
  orden y alineadas en horizontal. El docente de una boleta es el de la asignación con
  `is_main_report` de esa sección; su firma sale de `teacher_signatures` y solo se imprime si
  tiene `is_active`. Las imágenes se inlinean a data URL (`resolveSignatureImages`) porque
  html2canvas no puede dibujar una URL cruda de S3.

- **El representante no ve nada por defecto**: cada momento se publica explícitamente desde la
  pestaña de visibilidad, y el bloqueo por estudiante y la morosidad tienen prioridad sobre la
  publicación.

## Archivos clave (código)
- `src/pages/school/GradesConsultation.tsx` (3 pestañas + `openBoletaPreview`)
- `src/components/grades/FinalGradesTab.tsx` (notas finales / construcción de boletas — school)
- `src/pages/teacher/TeacherGrades.tsx` → `src/components/teacher/TeacherReportCard.tsx` (docente)
- `src/components/grades/PrimaryFinalReportModal.tsx` (informe descriptivo + vista previa en vivo)
- `src/pages/school/FormatsConfig.tsx` (contenedor de pestañas Facturas/Boletas)
- `src/components/grades/BolletasFormatTab.tsx` (editor de formato de boleta)
- `src/components/grades/SignatureFields.tsx` (campos de firma, compartidos por el editor de
  formato y las pantallas de notas)
- `src/components/grades/TeacherSignatureCard.tsx` (firma propia del docente; se monta en
  `FinalGradesTab.tsx` para el rol school y en `teacher/TeacherReportCard.tsx` para el docente)
- `src/lib/bachilleratoTemplate.ts` (tipos + render HTML puro, sin acceso a datos),
  `src/lib/bachilleratoBoleta.ts`, `src/lib/primaryDescriptiveBoleta.ts` (datos + composición),
  `src/lib/export-utils.ts`
- `src/lib/image-resolve.ts` — `resolveImageToDataUrl` / `fetchAsBase64` /
  `resolveSignatureImages`: **obligatorio** para cualquier imagen que acabe en un PDF.
- `src/pages/representative/StudentGrades.tsx` (módulo del representante),
  `src/components/grades/StudentGradesPanel.tsx`, `src/components/grades/StudentBoletaDownload.tsx`
- `src/components/grades/RepresentativeVisibilityTab.tsx` (pestaña de configuración),
  `src/components/students/StudentGradeAccessToggle.tsx` (bloqueo por alumno, 3 puntos de entrada)
- `src/hooks/useStudentGradesAccess.ts`, `useStudentReportCard.ts`,
  `useGradeVisibilitySettings.ts`, `useStudentGradeBlock.ts`
- `src/lib/gradesAccess.ts` (motivo del gate → mensaje), `src/lib/gradeLevels.ts`
  (catálogo de grados y `resolveGradeLevelKind`, antes duplicado en `GradesConsultation` y
  `FinalGradesTab`), `src/lib/boletaTemplateSelection.ts` (`pickBoletaTemplate`, antes duplicado
  5 veces en los generadores), `src/lib/studentName.ts`
- `src/lib/s3-upload.ts` — `uploadToS3`; las imágenes de firma van al folder `assets`
  (prefijos `boleta-sig-` y `teacher-sig-`) vía la edge function `s3-sign-upload`.

## Por documentar
- Estructura de notas: cómo se calculan promedios y definitivas a partir del plan de evaluación
  (`use_percentage_plan`), y el flujo de `adjustment_points`.
- Boleta de **Preescolar**: la pestaña "Descarga de Boletas" aún muestra "Próximamente".
