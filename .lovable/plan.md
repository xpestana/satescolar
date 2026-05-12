
## Objetivo

Permitir que estudiantes y representantes que no son de Venezuela puedan registrar su lugar de nacimiento. Cuando el país sea Venezuela, se mantienen los selects en cascada actuales (estado → municipio → ciudad → parroquia). Cuando sea cualquier otro país, esos cuatro campos se convierten en inputs de texto libre, guardándose en las **mismas claves** de `form_data` para no romper nada.

## Cambios

### 1. Catálogo de países

- Copiar `countries.json` a `src/data/countries.json`.
- Crear `src/lib/countries.ts` que exporte:
  - `COUNTRIES`: lista en español, con "Venezuela" como primer elemento.
  - `isVenezuela(value)`: helper tolerante (mayúsculas/acentos).

### 2. `src/components/forms/GroupedFormFields.tsx`

- En `renderGeographicField`:
  - **`pais`**: pasa de `Select` deshabilitado (solo Venezuela) a `Select` real con todos los países. Default sigue siendo "Venezuela" si no hay valor.
  - **`estado` / `municipio` / `ciudad` / `parroquia`**:
    - Calcular `paisValue = formData[geoKey("pais")] ?? "Venezuela"`.
    - Si `isVenezuela(paisValue)` → comportamiento actual (selects en cascada con IDs).
    - Si NO es Venezuela → renderizar `<Input type="text">` que escribe directo en la misma clave de `form_data` (`estado_nacimiento`, etc.).
- Al cambiar el país a uno distinto de Venezuela, **limpiar** los UUIDs previos en estas 4 claves (para evitar que un UUID viejo quede mostrado como texto). Al regresar a Venezuela, también limpiar para forzar nueva selección.
- El bloque que auto-persiste "Venezuela" en `pais` se mantiene solo como **valor inicial por defecto**, no como sobrescritura.

### 3. Resolución de etiquetas en lecturas (compatibilidad)

Donde hoy se asume que el valor es UUID y se hace lookup en tablas geográficas:

- `src/pages/school/EnrollmentsList.tsx`
- `src/lib/export-utils.ts`

Aplicar fallback: si el valor no se resuelve a un nombre desde la tabla (porque es texto libre internacional), mostrarlo tal cual. No requiere cambios de esquema; sólo hacer la resolución tolerante a strings que no son UUID.

### 4. Migración de base de datos

Una sola migración SQL que:

#### 4.1 Actualiza el trigger `create_default_form_fields`

- Cambia las opciones de `student.pais_nacimiento` y `representative.pais_nacimiento` (y `teacher.pais_nacimiento`) a la lista completa de países (string array JSON).
- Mantiene "Venezuela" como primer ítem (default visual).

#### 4.2 Acomoda colegios existentes

- `UPDATE public.form_fields SET options = '<lista_completa_jsonb>' WHERE field_name = 'pais_nacimiento'` (alcanza a estudiantes, representantes y docentes de todos los colegios ya creados).
- No toca `form_data` existente: los registros en Venezuela siguen guardando UUIDs en `estado_nacimiento`, etc.; los nuevos no-VE guardarán strings en esas mismas claves.

### 5. Sin cambios de esquema

- No se crean ni alteran columnas.
- Las claves `pais_nacimiento`, `estado_nacimiento`, `municipio_nacimiento`, `ciudad_nacimiento`, `parroquia_nacimiento` siguen viviendo en `students.form_data` / `representatives.form_data` exactamente como hoy.

## Aclaraciones técnicas

- **Tipo de dato mixto en `form_data`**: para los 4 campos geográficos dependientes el valor podrá ser un UUID (caso Venezuela) o un string libre (caso internacional). Esto es seguro porque `form_data` es `jsonb`.
- **PDF / exportaciones**: los puntos de lectura que hoy hacen JOIN con `states`/`municipalities`/etc. seguirán funcionando para Venezuela; para el resto basta con imprimir el string crudo cuando el JOIN no devuelve fila.
- **Default visual**: el país queda preseleccionado como "Venezuela" para no afectar el flujo normal de la mayoría de inscripciones.
