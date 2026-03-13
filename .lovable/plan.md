

## Plan: Configuraciones de Primaria - Tipo de Boleta, Indicadores y Escalas

### Resumen

Agregar al card de **Primaria** en Ajustes de Notas:
1. **Selector de tipo de boleta**: Descriptiva o Por Indicadores (radio/select)
2. **Modal de indicadores** (solo si elige "Por Indicadores"): CRUD de indicadores por grado (1°-6°), cada uno con nombre de área (texto libre) y descripción, reordenables
3. **Sección de escalas**: CRUD de escalas con sigla y descripción (como en la imagen de referencia)

---

### 1. Base de datos - 3 nuevas tablas + 1 columna

**Agregar columna a `grades_config`:**
- `primary_report_type text not null default 'descriptive'` -- valores: `'descriptive'` | `'indicators'`

**Nueva tabla `primary_grade_indicators`:**
| Columna | Tipo |
|---------|------|
| id | uuid PK |
| school_id | uuid FK schools |
| grade_level | text (e.g. "1", "2"..."6") |
| area_name | text |
| description | text |
| display_order | int default 0 |
| created_at / updated_at | timestamptz |

**Nueva tabla `primary_grading_scales`:**
| Columna | Tipo |
|---------|------|
| id | uuid PK |
| school_id | uuid FK schools |
| abbreviation | text (sigla) |
| description | text |
| display_order | int default 0 |
| created_at / updated_at | timestamptz |

RLS: Mismas politicas patron que `grades_config` (admin ALL + school users CRUD by school_id).

### 2. UI - Modificaciones en `GradesSettings.tsx`

**Card de Primaria** reemplaza el placeholder con:

- **Tipo de boleta**: Radio group o Select con opciones "Descriptiva" / "Por Indicadores". Se guarda en `grades_config.primary_report_type`. Mutation upsert al cambiar.

- **Botón "Gestionar Indicadores"**: Solo visible si tipo = "indicators". Abre un modal.

- **Sección Escalas**: Lista de escalas (sigla + descripción) con botón agregar (+), editar inline o con inputs, y botón eliminar (X rojo como en la imagen). Reordenables.

### 3. Modal de Indicadores (nuevo componente)

`src/components/grades/PrimaryIndicatorsModal.tsx`:
- Select de grado (1° a 6°)
- Tabla/lista de indicadores filtrados por grado seleccionado
- Inputs para agregar: nombre del área + descripción + botón agregar
- Cada fila: área, descripción, botones editar/eliminar, drag para reordenar (o flechas arriba/abajo)
- CRUD contra `primary_grade_indicators`

### 4. Sección Escalas (inline en el card o componente separado)

Renderizado directamente en el card de Primaria:
- Input sigla + input descripción + botón agregar
- Lista con sigla, descripción, botón eliminar
- Edición inline al hacer click
- CRUD contra `primary_grading_scales`

### Archivos a crear/modificar

| Archivo | Accion |
|---------|--------|
| Migration SQL | Crear - columna + 2 tablas + RLS |
| `src/pages/school/GradesSettings.tsx` | Modificar - agregar lógica primaria |
| `src/components/grades/PrimaryIndicatorsModal.tsx` | Crear |

