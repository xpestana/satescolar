

## Plan: Notas Finales para Primaria — Informe Descriptivo / Por Indicadores + Literal

### Contexto
Actualmente, `FinalGradesTab` trata todos los niveles igual: muestra un campo numérico o de texto para la nota definitiva de cada momento. Para **primaria** (grade_levels `1_grado` a `6_grado`), el flujo debe cambiar completamente según la configuración del colegio (`grades_config.primary_report_type`): "descriptive" o "indicators".

### Lo que se va a construir

**1. Nueva tabla en BD: `primary_final_reports`**
Para almacenar los informes descriptivos finales de primaria por momento y por estudiante:
- `student_id`, `assignment_id`, `school_id`, `momento` (1,2,3,0)
- `descriptive_report` (text — HTML del informe descriptivo)
- `literal` (text — letra A-E, se convierte a mayúscula)
- `absence_count`, `attendance_count`
- `final_status` (solo para momento 0)
- Unique constraint: `(student_id, assignment_id, momento)`

**2. Nueva tabla en BD: `primary_final_indicator_grades`**
Para almacenar la escala asignada a cada indicador por estudiante por momento:
- `student_id`, `assignment_id`, `school_id`, `momento`
- `indicator_id` (FK → `primary_grade_indicators.id`)
- `scale_id` (FK → `primary_grading_scales.id`)
- Unique constraint: `(student_id, assignment_id, momento, indicator_id)`

**3. Cambio en `FinalGradesTab`**
- Detectar si la sección es de primaria (`1_grado` a `6_grado`)
- Si es primaria, consultar `grades_config` para saber si es `descriptive` o `indicators`
- Cambiar la tabla para mostrar por cada momento:
  - Un botón "Redactar Informe" (ícono de documento) que abre un modal
  - Un campo de **Literal** (A-E, auto-uppercase, validado)
  - Campos de asistencias/inasistencias (ya existentes)
- La columna "Definitiva Final" mantiene el literal final + estado

**4. Nuevo componente: `PrimaryFinalReportModal`**
Modal que se abre al hacer clic en "Redactar Informe". Contiene:
- **Panel izquierdo**: Lo que escribió el docente en cada momento (read-only, tabs por momento mostrando las notas de `student_grades` + `evaluation_plan_items`)
- **Panel derecho** con dos variantes según configuración:
  - **Descriptivo**: RichTextEditor (ya existe `RichTextEditor`) para escribir el informe final de cada momento, con tabs "Final de momentos" / "Final de año escolar"
  - **Por Indicadores**: Carga las áreas e indicadores de `primary_indicator_areas` + `primary_grade_indicators` filtrados por el `grade_level` de la sección, y muestra un `<Select>` por cada indicador con las escalas de `primary_grading_scales` del colegio
- Botón Guardar que persiste en `primary_final_reports` y/o `primary_final_indicator_grades`

**5. Validación del Literal**
- Solo acepta letras A-E (case insensitive)
- Auto-convierte a mayúscula en `onChange`
- Se persiste en `primary_final_reports.literal`

### Detalle técnico

**Tablas nuevas (2 migraciones SQL):**

```sql
CREATE TABLE public.primary_final_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  assignment_id uuid NOT NULL,
  school_id uuid NOT NULL,
  momento integer NOT NULL DEFAULT 1,
  descriptive_report text DEFAULT '',
  literal text DEFAULT '',
  attendance_count integer DEFAULT 0,
  absence_count integer DEFAULT 0,
  final_status text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(student_id, assignment_id, momento)
);

CREATE TABLE public.primary_final_indicator_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  assignment_id uuid NOT NULL,
  school_id uuid NOT NULL,
  momento integer NOT NULL,
  indicator_id uuid NOT NULL,
  scale_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(student_id, assignment_id, momento, indicator_id)
);
```

Con RLS policies idénticas a `final_grades` (admin ALL, school SELECT, teacher ALL via assignment).

**Archivos a modificar/crear:**
- `src/components/grades/FinalGradesTab.tsx` — Detectar primaria, cambiar renderizado de celdas
- `src/components/grades/PrimaryFinalReportModal.tsx` — Nuevo modal con vista descriptiva o indicadores
- 1 migración SQL para las 2 tablas + RLS + foreign keys

**Set de grados primaria:**
```typescript
const PRIMARY_GRADES = new Set([
  "1_grado", "2_grado", "3_grado", "4_grado", "5_grado", "6_grado"
]);
```

### Flujo de usuario
1. El colegio selecciona una materia + sección de primaria en "Notas Finales y Boletas"
2. La tabla muestra por cada estudiante y momento: botón de redactar + campo literal (A-E) + asistencias/inasistencias
3. Al hacer clic en "Redactar", se abre el modal con las notas del docente a la izquierda y el editor a la derecha
4. El usuario redacta, selecciona escalas (si es por indicadores), y guarda
5. El literal se muestra directamente en la tabla principal

