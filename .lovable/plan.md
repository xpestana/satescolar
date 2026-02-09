

# Plan: Corregir campos geográficos en formularios dinámicos

## Problema encontrado

Los campos geográficos en la base de datos se llaman `pais_nacimiento`, `estado_nacimiento`, `municipio_nacimiento`, `ciudad_nacimiento`, `parroquia_nacimiento`, pero el componente `GroupedFormFields.tsx` busca `pais`, `estado`, `municipio`, `ciudad`, `parroquia`. Por eso nunca se activa la lógica especial de cascada y los campos aparecen como selects vacíos sin opciones.

## Solucion

### 1. Actualizar la constante GEOGRAPHIC_FIELDS en `GroupedFormFields.tsx`

Cambiar la deteccion para que reconozca tanto los nombres cortos (`estado`, `municipio`, etc.) como los nombres con sufijo (`estado_nacimiento`, `municipio_nacimiento`, etc.). De esta forma, cualquier campo cuyo nombre termine en `_nacimiento` o coincida exactamente, recibira el tratamiento especial de cascada.

### 2. Actualizar `renderGeographicField` para manejar ambos nombres

Modificar las condiciones `if (field.field_name === "estado")` para que tambien cubran `estado_nacimiento`, y lo mismo para municipio, ciudad, parroquia y pais. El valor se guardara en formData con el nombre real del campo (ej: `estado_nacimiento`).

### 3. Actualizar los handlers de cascada

Los handlers `handleStateChange`, `handleMunicipalityChange` deben limpiar los campos dependientes usando los nombres correctos. Para eso se necesita una funcion que mapee el nombre generico al nombre real del campo basandose en los campos disponibles.

### Detalles tecnicos

Se refactorizara `GroupedFormFields.tsx` para:

- Crear un mapeo dinamico: al recibir los `fields`, detectar automaticamente si los campos geograficos usan sufijo `_nacimiento` o no
- Usar ese mapeo en `effectiveStateId`, `effectiveMunicipalityId`, etc. para leer del `formData` con la clave correcta
- Actualizar `handleStateChange` y `handleMunicipalityChange` para escribir en `formData` con la clave correcta
- `renderGeographicField` usara `field.field_name` directamente como clave de formData en lugar de hardcodear "estado", "municipio", etc.

Esto mantiene la compatibilidad hacia atras (si algun formulario usa los nombres cortos, seguira funcionando) y resuelve el problema actual donde los nombres son `*_nacimiento`.

