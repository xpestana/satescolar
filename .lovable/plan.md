

## Plan: Constructor de Planilla de Inscripcion con Secciones por Defecto

### Resumen
Reestructurar el constructor de planilla para que al crear un colegio se generen automaticamente 5 secciones predefinidas con los campos correctos. Ademas, agregar campos faltantes de familia (ubicacion geografica) y una seccion especial de "Compromiso del Representante" con texto editable.

---

### Cambios planificados

#### 1. Agregar campos de ubicacion a la lista de familia
En `EnrollmentDisplayConfig.tsx`, agregar los campos de ubicacion geografica que faltan en `familyFields`:
- Estado, Municipio, Ciudad, Parroquia (como campos `state`, `municipality`, `city`, `parish`)

Tambien agregar un campo especial `family:location_full` que en la planilla impresa combinara Estado + Municipio + Ciudad + Parroquia en una sola linea.

#### 2. Agregar soporte para secciones de tipo "texto libre"
Actualmente las secciones solo soportan campos con datos. Se necesita un nuevo tipo de seccion que contenga un bloque de texto largo (para Observaciones y Compromiso del Representante).

Se agregara una columna `section_type` y `section_text` a la tabla `enrollment_planilla_sections`:
- `section_type`: `'fields'` (por defecto) o `'text'`
- `section_text`: texto libre para secciones de tipo texto

#### 3. Migracion de base de datos
Nueva migracion SQL que:
1. Agrega `section_type text NOT NULL DEFAULT 'fields'` y `section_text text DEFAULT ''` a `enrollment_planilla_sections`
2. Actualiza la funcion `create_default_form_fields()` para insertar 5 secciones por defecto al crear un colegio
3. Inserta las secciones por defecto para colegios existentes (que no tengan secciones aun)

Las 5 secciones por defecto seran:

**Seccion 1 - "Datos Personales del Estudiante"** (type: fields)
- `student:primer_apellido`, `student:segundo_apellido`, `student:primer_nombre`, `student:segundo_nombre`
- `student:documento`, `student:email`, `student:numero_contacto`, `student:_edad`
- `student:fecha_nacimiento`, `student:ciudad_nacimiento`

**Seccion 2 - "Datos de Familia"** (type: fields)
- `family:email`, `family:contact_phone`, `family:address`, `family:location_full`

**Seccion 3 - "Datos del Representante"** (type: fields)
- `representative:documento`, `representative:primer_apellido`, `representative:segundo_apellido`, `representative:_edad`
- `representative:pais_nacimiento` (campo custom si no existe en el form), `representative:fecha_nacimiento`, `representative:numero_contacto`

**Seccion 4 - "Informacion para la Inscripcion"** (type: fields)
- `student:grado`, `custom:grupo_asignado`, `custom:tipo_de_estudiante`, `custom:fecha_de_inscripcion`

**Seccion 5 - "Observaciones"** (type: text)
- Texto vacio por defecto, area para rellenar

**Seccion 6 - "Compromiso del Representante"** (type: text)
- Texto por defecto: "Hago constar por medio de la presente, que he leido, acepto y me comprometo a cumplir las condiciones establecidas en el contrato de Prestacion de Servicio educativo para el ano escolar que se indica en esta planilla, asi como los deberes y obligaciones conforme a las leyes y reglamentos vigentes del Estado Venezolano. Del mismo modo, mi representado y yo, nos comprometemos a respetar los acuerdos de Convivencia de la Institucion.\n\nImportante: El Proceso de Inscripcion se concretara una vez efectuado el pago por concepto de inscripcion y primer mes, la consignacion fisica de la Planilla de Registro y firma del Contrato de Prestacion de Servicios Educativos."

#### 4. Actualizar la UI del constructor
En `EnrollmentDisplayConfig.tsx`:

- Al agregar seccion, permitir elegir tipo: "Campos de datos" o "Bloque de texto"
- Para secciones tipo `text`: mostrar un `Textarea` para editar el contenido del texto
- Para secciones tipo `fields`: mantener la UI actual con los accordions de Estudiante/Representante/Familia/Custom
- Actualizar la previsualizacion para mostrar secciones de texto como bloques con borde y el texto contenido
- Agregar `location_full` a familyFields como campo especial

#### 5. Actualizar save/load
- Incluir `section_type` y `section_text` en las operaciones de guardado e insercion
- Cargar estos campos al recuperar las secciones existentes

---

### Detalles tecnicos

**Migracion SQL:**
```text
ALTER TABLE enrollment_planilla_sections 
  ADD COLUMN section_type text NOT NULL DEFAULT 'fields',
  ADD COLUMN section_text text DEFAULT '';

-- Actualizar create_default_form_fields() para incluir inserts de secciones
-- Insertar secciones por defecto para colegios existentes
```

**Archivos a modificar:**
- `src/pages/school/EnrollmentDisplayConfig.tsx` - UI del constructor, nuevos campos familia, soporte texto
- Nueva migracion SQL via herramienta de migracion

**Interfaz PlanillaSection actualizada:**
```text
interface PlanillaSection {
  id?: string;
  title: string;
  field_names: string[];
  display_order: number;
  section_type: 'fields' | 'text';
  section_text: string;
}
```

**Previsualizacion de seccion tipo texto:**
- Se renderiza con borde punteado, el titulo como encabezado y el texto debajo en italica
- Para "Observaciones" se muestra una linea vacia para rellenar

