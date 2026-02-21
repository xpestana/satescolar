

## Plan: Desplegable de descargas y Planilla de Inscripcion en PDF

### Resumen

Reemplazar el boton simple de "Carnet" en la lista de estudiantes del representante por un desplegable (dropdown) con dos opciones: **Carnet** y **Planilla de Inscripcion**. La planilla se generara como PDF siguiendo el formato proporcionado, usando los datos del estudiante, la familia, el representante principal, las secciones configuradas en `enrollment_planilla_sections`, y la configuracion general de `planilla_general_config`.

Ademas, se agregara un campo `is_primary` a la tabla `representatives` para marcar al representante principal de cada familia.

---

### Cambios necesarios

#### 1. Migracion de base de datos
- Agregar columna `is_primary` (boolean, default false) a la tabla `representatives`.
- Ejecutar un UPDATE para marcar como `is_primary = true` al representante mas antiguo (`created_at` menor) de cada familia que aun no tenga ninguno marcado. Esto cubre los colegios ya creados.

#### 2. Nueva funcion: `downloadPlanillaInscripcion` en `src/lib/export-utils.ts`
Funcion que genera el PDF multi-pagina con:

**Encabezado (cada pagina):**
- Logo del colegio (izquierda), datos institucionales (centro), fotos del representante y estudiante (derecha)
- Titulo "PLANILLA" y "ANO ESCOLAR: XXXX-XXXX"
- Nota de advertencia sobre datos exactos

**Pagina 1 - Datos identificativos:**
- Mini-tabla con primer apellido, segundo apellido, primer nombre, segundo nombre del estudiante
- Luego se renderizan las secciones configuradas en `enrollment_planilla_sections`:
  - Tipo `fields`: tabla con los campos seleccionados, resolviendo los valores desde `student.form_data`, `representative.form_data`, o los campos de `families`
  - Tipo `text`: bloque de texto libre (ej: compromiso del representante)
- Si una seccion tiene datos de la familia, representante o inscripcion, se colocan en formato tabla

**Pie de pagina (cada pagina):**
- Lineas de firma configuradas en `planilla_general_config.signature_lines`
- Direccion, telefono, RIF segun configuracion de footer
- Texto "Documento generado de forma automatica por SAT Escolar"

**Datos que se consultan:**
- Estudiante: `students` (form_data, photo_url, document_id)
- Representante principal: `representatives` donde `is_primary = true` y `family_id` del estudiante
- Familia: `families` (apellidos, direccion, telefono, etc.)
- Colegio: `schools` + ubicacion geografica (states, municipalities, cities, parishes)
- Secciones de planilla: `enrollment_planilla_sections`
- Config general: `planilla_general_config` (header, footer, firmas)
- Ano escolar activo: `school_years`
- Inscripcion del estudiante (si existe): `enrollments` + `sections` para grado/seccion

#### 3. Modificar `src/pages/representative/StudentsList.tsx`
- Reemplazar el boton "Carnet" por un `DropdownMenu` con dos items:
  - "Descargar Carnet" (logica actual)
  - "Descargar Planilla de Inscripcion" (nueva funcion)
- Importar `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger` de los componentes UI
- El boton trigger dira "Descargas" con icono `ChevronDown`

#### 4. Marcar representante principal al crear
- En `src/pages/representative/RepAddRepresentative.tsx` (o donde se cree el representante), al insertar el primer representante de una familia, marcarlo como `is_primary = true`

---

### Detalles tecnicos

**Estructura del PDF (jsPDF):**
- Orientacion: portrait, tamano carta
- Cada pagina repite: header con logo + info colegio + fotos, y footer con firmas + info institucional
- Las secciones se renderizan secuencialmente; si no caben en una pagina, se hace salto automatico con `autoTable` y se repite el mini-header (apellidos/nombres del estudiante)
- Campos sin datos se muestran como "No registrado"
- Los campos tipo `_edad` se calculan automaticamente desde `fecha_nacimiento`
- Los campos tipo `location_full` se resuelven consultando las tablas geograficas

**Resolucion de campos prefijados:**
Los `field_names` en `enrollment_planilla_sections` usan el formato `tipo:nombre_campo`:
- `student:campo` -> buscar en `student.form_data`
- `representative:campo` -> buscar en `representative.form_data`  
- `family:campo` -> buscar en la tabla `families`
- `custom:campo` -> campo personalizado
- `student:_edad` -> calculado desde `student:fecha_nacimiento`

**Archivos a crear/modificar:**
1. Migracion SQL (nueva columna `is_primary`)
2. `src/lib/export-utils.ts` - nueva funcion `downloadPlanillaInscripcion`
3. `src/pages/representative/StudentsList.tsx` - dropdown de descargas
4. `src/pages/representative/RepAddRepresentative.tsx` - marcar `is_primary` en primer representante
