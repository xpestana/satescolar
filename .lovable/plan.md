

## Plan: Constructor de Planillas y Certificados

### Resumen

Agregar una nueva pestaña "Constructor de Planillas" como primer tab en la página `/planillas`. Permitirá al usuario redactar documentos personalizados (constancias, certificados, etc.) usando un editor WYSIWYG, con la posibilidad de insertar datos de un estudiante seleccionado mediante snippets/variables. Los documentos se pueden guardar como plantillas reutilizables para uso futuro.

### Concepto de Snippets

En lugar de copiar datos manualmente, el usuario inserta **variables** (snippets) como `{{primer_nombre}}`, `{{documento}}`, `{{grado}}`, etc. Al generar el PDF, el sistema reemplaza automáticamente cada variable con los datos reales del estudiante seleccionado. Esto permite crear una plantilla una sola vez y reutilizarla con cualquier alumno.

### Cambios necesarios

#### 1. Nueva tabla: `document_templates`

Almacena las plantillas guardadas por cada colegio.

```sql
CREATE TABLE public.document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  name text NOT NULL,
  content_html text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
-- RLS: school users can CRUD their templates
```

#### 2. Nuevo componente: `DocumentBuilder.tsx`

Contendrá:

- **Buscador de estudiante**: campo de búsqueda que filtra estudiantes inscritos del colegio. Al seleccionar uno, se cargan sus datos.
- **Panel de variables**: botones organizados en grupos (Datos Personales, Datos de Inscripción, Datos de Familia) que al hacer clic insertan el snippet correspondiente (ej. `{{primer_nombre}}`) en la posición del cursor del editor.
- **Editor WYSIWYG**: reutiliza el `RichTextEditor` existente, con soporte para insertar HTML en la posición del cursor.
- **Previsualización**: muestra el documento con los snippets reemplazados por los datos reales del estudiante seleccionado, incluyendo header/footer de la configuración de planilla (`planilla_general_config`).
- **Guardar como plantilla**: input de nombre + botón para guardar el contenido HTML actual como plantilla reutilizable.
- **Cargar plantilla**: selector con las plantillas guardadas; al elegir una, carga el HTML en el editor.
- **Descargar PDF**: genera el documento final con header institucional, contenido con datos reales, y footer con firmas.

#### 3. Variables disponibles (snippets)

**Estudiante**: `primer_nombre`, `segundo_nombre`, `primer_apellido`, `segundo_apellido`, `documento`, `fecha_nacimiento`, `ciudad_nacimiento`, `email`, `grado`, `seccion`, `numero_contacto`

**Inscripción**: `tipo_de_estudiante`, `grupo_asignado`, `fecha_de_inscripcion`, `año_escolar`

**Familia**: `apellido_paterno`, `apellido_materno`, `telefono`, `direccion`

**Representante**: `rep_primer_nombre`, `rep_primer_apellido`, `rep_documento`

**Sistema**: `fecha_actual`, `nombre_colegio`

#### 4. Modificaciones a `GradeSheets.tsx`

- Agregar nueva pestaña "Constructor" como primer tab (value `constructor`, defaultValue cambia a `constructor`).
- Importar y renderizar el componente `DocumentBuilder` dentro del `TabsContent`.

### Archivos a crear/modificar

| Archivo | Acción |
|---|---|
| `src/components/utilities/DocumentBuilder.tsx` | Crear (componente principal) |
| `src/pages/school/GradeSheets.tsx` | Modificar (agregar tab) |
| Migración SQL | Crear tabla `document_templates` con RLS |

### Flujo de uso

1. El usuario abre la pestaña "Constructor de Planillas"
2. Opcionalmente carga una plantilla guardada
3. Busca y selecciona un estudiante
4. Escribe en el editor y hace clic en los botones de variables para insertar snippets
5. Previsualiza el resultado con datos reales
6. Descarga como PDF o guarda como plantilla para reutilizar

