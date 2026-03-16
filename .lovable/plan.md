

## Plan: Selector de plantillas de boletas por nivel

### Objetivo
Agregar a cada card de nivel en "Ajustes de Notas" un selector de plantilla de boleta. Las plantillas se definen como un catálogo hardcoded (por ahora) y se filtran según el tipo de boleta configurado. La selección se persiste en `grades_config`.

### 1. Migración de base de datos
Agregar 3 columnas a `grades_config`:
- `preschool_template` (text, default `'classic'`)
- `primary_template` (text, default `'classic'`)
- `secondary_template` (text, default `'classic'`)

### 2. Catálogo de plantillas (hardcoded en el componente)
Definir un arreglo de plantillas por nivel, cada una con: `id`, `name`, `description`, `compatibleTypes` (para filtrar por tipo de boleta), y una miniatura visual básica (componente React simple que simule el layout de la boleta).

**Preescolar** (filtrado por `descriptive` / `indicators`):
- `classic` - Boleta Clásica (compatible con ambos tipos)
- `colorful` - Boleta Colorida (compatible con ambos tipos)
- `minimal` - Boleta Minimalista (compatible con ambos tipos)

**Primaria** (filtrado por `descriptive` / `indicators`):
- `classic` - Boleta Clásica
- `detailed` - Boleta Detallada
- `compact` - Boleta Compacta

**Secundaria** (sin filtro de tipo):
- `classic` - Boleta Clásica
- `formal` - Boleta Formal
- `modern` - Boleta Moderna

### 3. UI en GradesSettings
Debajo de las configuraciones actuales de cada card, agregar una sección "Plantilla de boleta" con:
- Cards pequeñas en grid (2 columnas) mostrando una miniatura/preview estilizada de cada plantilla
- Borde resaltado en la plantilla seleccionada
- Click para seleccionar, se guarda automáticamente vía `upsertConfig`

### 4. Componente de preview de plantilla
Crear `src/components/grades/TemplatePreview.tsx` -- un componente que renderiza una miniatura abstracta (rectángulos y líneas simulando el layout) con colores distintos por template, para dar una idea visual del diseño.

### Archivos a modificar/crear
- **Migración SQL**: agregar 3 columnas a `grades_config`
- **`src/components/grades/TemplatePreview.tsx`**: nuevo componente con las miniaturas
- **`src/pages/school/GradesSettings.tsx`**: agregar sección de selección de plantilla en cada card

