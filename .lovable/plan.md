

## Plan: Enriquecer el modal de informe primaria con campos adicionales

### Contexto
El `PrimaryFinalReportModal` actual tiene indicadores + observación descriptiva, pero le faltan campos que aparecen en la referencia: **literal del momento**, **inasistencias**, **nombre del proyecto**, y **nombre/cédula del docente**. Estos campos deben aparecer tanto en modo descriptivo como en modo indicadores.

### Cambios en BD
Agregar columna `project_name` a `primary_final_reports` — los demás campos (literal, absence_count, descriptive_report) ya existen. El nombre/cédula del docente se obtiene del `assignment → teacher`.

### Cambios en `PrimaryFinalReportModal`
1. **Fetch teacher info** desde `subject_teacher_assignments` → `teachers` (nombre y cédula del docente asignado) — campos read-only
2. **Agregar estados** para `literal` (A-E, auto-uppercase) y `projectName`
3. **Inicializar** desde `existingReport` los campos literal, absence_count, project_name
4. **Renderizar debajo de los indicadores/descripción** una sección "Observaciones y Literal" con:
   - Campo Literal (input A-E, auto-uppercase)
   - Editor WYSIWYG (RichTextEditor) para observaciones descriptivas
   - Input numérico de inasistencias
   - Input texto para nombre del proyecto del momento
   - Campos read-only: nombre y cédula del docente
5. **Guardar** todos los campos en el payload de upsert a `primary_final_reports`

### Archivos a modificar
- **1 migración SQL**: `ALTER TABLE primary_final_reports ADD COLUMN project_name text DEFAULT '';`
- **`PrimaryFinalReportModal.tsx`**: Agregar query del teacher, estados para literal/absences/project_name, sección de campos adicionales, actualizar handleSave

