## Objetivo

Permitir que estudiantes y representantes (y docentes) puedan registrar país, estado, municipio, ciudad y parroquia cuando NO son de Venezuela, manteniendo el comportamiento actual con selects en cascada cuando el país sí es Venezuela.

## Comportamiento

- Campo **País**: pasa de estar fijo en "Venezuela" a un `Select` con la lista completa de países (la lista ya existe dentro de la función `create_default_form_fields` en la base de datos).
- Si el país elegido es **Venezuela** → estado / municipio / ciudad / parroquia siguen siendo selects en cascada con UUIDs (igual que hoy).
- Si el país es **cualquier otro** → estado / municipio / ciudad / parroquia se renderizan como `<input type="text">` libres y se guardan como texto plano en las MISMAS claves de `form_data` (`estado_nacimiento`, `municipio_nacimiento`, `ciudad_nacimiento`, `parroquia_nacimiento`). No se cambia ni la columna ni la clave: el JSONB ya admite tanto UUID como texto.
- Al cambiar el país de Venezuela → otro (o viceversa), se limpian los valores previos de los 4 campos dependientes para evitar que queden UUIDs colgados al guardar como texto, o textos colgados al guardar como UUID.

## Cambios de código (frontend)

`src/components/forms/GroupedFormFields.tsx`:
- Nueva utilidad `isVenezuela(value)` (compara case-insensitive).
- Cargar la lista de países desde el propio `field.options` del campo `pais_*` (que ya viene de la BD); fallback a una constante local solo por seguridad.
- `renderGeographicField` para `pais`: render real con `Select` poblado por `field.options`, persistiendo el valor elegido. Eliminar el bloque `useMemo` que forzaba "Venezuela".
- Para `estado / municipio / ciudad / parroquia`: leer el valor de país efectivo (formData[geoKey('pais')]); si NO es Venezuela, renderizar `Input` text que escribe directo al `formData[field.field_name]`. Si es Venezuela, mantener exactamente la lógica actual.
- `handlePaisChange`: si el nuevo valor difiere del anterior y alguno de los dos lados es/era Venezuela, limpiar `estado / municipio / ciudad / parroquia` para no mezclar UUID con texto.
- Sin cambios en las props, en los formularios padres (`AddStudent`, `RepAddStudent`, `AddRepresentative`, `RepAddRepresentative`, `EditFamily`, `AddTeacher`, etc.) ni en cómo se guarda en la BD.

## Compatibilidad de lectura

Los lugares que resuelven UUID → nombre (`EnrollmentsList`, `export-utils`, `ViewRecordModal`, etc.) ya muestran el valor crudo cuando no encuentran UUID. Verificación rápida: si el string guardado no es un UUID válido, se imprime tal cual. No se requieren cambios estructurales — solo confirmar el fallback en utilidades de exportación. Si alguna ruta hace lookup estricto, añadiremos un fallback `value if !isUUID`.

## Cambios de base de datos (migración)

1. **Trigger `create_default_form_fields`**: el array `v_countries` ya contiene la lista completa de ~190 países, por lo que los colegios nuevos no requieren cambio aquí. (Si está desactualizado en producción, la migración lo reescribe `CREATE OR REPLACE` con el listado completo).
2. **Colegios existentes**: `UPDATE form_fields SET options = '<lista completa de países>'::jsonb WHERE field_name = 'pais_nacimiento' AND field_type = 'select'`. Esto garantiza que en las instalaciones ya creadas también aparezcan todos los países en el select sin tocar el resto de la configuración.
3. No se alteran columnas: `students.form_data` y `representatives.form_data` siguen siendo `jsonb`.

## Despliegue en tu VPS dockerizado

Tras hacer `git pull` con los cambios + nueva migración SQL en `supabase/migrations/`:

```bash
cd ~/satescolar
git pull

# 1) Aplicar la nueva migración a la BD (usando el contenedor migrations one-shot)
docker compose run --rm sat-migrations

# 2) Recargar el cache de PostgREST (lo hace solo, pero por si acaso)
docker exec sat-db psql -U supabase_admin -d postgres -c "NOTIFY pgrst, 'reload schema';"

# 3) Reconstruir y reiniciar la app frontend
docker compose up -d --build sat-app
```

Si `sat-migrations` ya está en estado `Exited` y no quieres recrearlo:
```bash
docker start -a sat-migrations
```

Verificación rápida después del deploy:
- Entrar a "Agregar estudiante" → cambiar país a, p. ej., "Argentina" → confirmar que estado/municipio/ciudad/parroquia se vuelven inputs de texto.
- Volver a "Venezuela" → confirmar que regresan los selects en cascada.
- Guardar y reabrir el registro: el valor debe persistir y mostrarse correctamente.
