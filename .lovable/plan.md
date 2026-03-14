

## Plan: Configuración de Preescolar — Componentes por Momentos y Niveles

### Contexto
Preescolar tiene 4 niveles: **Prematernal, 1er Nivel, 2do Nivel, 3er Nivel**. Se organiza por **Momentos** (1er, 2do, 3er Momento). El usuario selecciona entre "Descriptivo con componentes" o "Indicadores por componentes". Cuando es por indicadores, se gestionan Componentes > Indicadores (por momento + nivel) y escalas de calificación. Sin datos por defecto.

### 1. Migración SQL

**Nueva columna en `grades_config`:**
- `preschool_report_type text NOT NULL DEFAULT 'descriptive'`

**Nuevas tablas:**

- `preschool_indicator_components` — equivalente a `primary_indicator_areas`
  - `id uuid PK`, `school_id uuid`, `level text` (prematernal/1/2/3), `momento text` (1/2/3), `name text`, `display_order int`, `created_at`, `updated_at`

- `preschool_component_indicators` — indicadores dentro de cada componente
  - `id uuid PK`, `school_id uuid`, `component_id uuid FK → preschool_indicator_components ON DELETE CASCADE`, `description text`, `display_order int`, `created_at`, `updated_at`

- `preschool_grading_scales` — escalas propias de preescolar
  - `id uuid PK`, `school_id uuid`, `abbreviation text`, `description text`, `display_order int`, `created_at`, `updated_at`

**RLS:** Mismas políticas que `primary_indicator_areas` y `primary_grading_scales` (school users CRUD + admins ALL).

### 2. GradesSettings.tsx — Card Preescolar

Reemplazar el placeholder con:
- Subtítulo: "Prematernal, 1er Nivel, 2do Nivel, 3er Nivel"
- RadioGroup: "Descriptivo con componentes" / "Por Indicadores"
- Si "indicadores":
  - Botón "Gestionar Componentes" → abre `PreschoolIndicatorsModal`
  - Sección CRUD de escalas (misma lógica que primaria, tabla `preschool_grading_scales`)

### 3. PreschoolIndicatorsModal (nuevo componente)

Basado en `PrimaryIndicatorsModal` con estas diferencias:
- **Selector de Nivel:** Prematernal, 1er Nivel, 2do Nivel, 3er Nivel
- **Selector de Momento:** 1er Momento, 2do Momento, 3er Momento
- Tablas: `preschool_indicator_components` y `preschool_component_indicators`
- Labels: "Componente" en vez de "Área"
- Se filtra por nivel + momento seleccionados
- CRUD completo para componentes e indicadores dentro de cada componente

### Archivos afectados
| Archivo | Acción |
|---------|--------|
| Nueva migración SQL | Crear 3 tablas + columna en grades_config |
| `src/pages/school/GradesSettings.tsx` | Actualizar card Preescolar |
| `src/components/grades/PreschoolIndicatorsModal.tsx` | Crear nuevo |

