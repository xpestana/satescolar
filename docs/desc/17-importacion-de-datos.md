# Importación de datos

> 🧭 Al implementar cambios de este tema, sigue las [Convenciones de desarrollo](CONVENTIONS.md)
> (código en inglés, SOLID, pruebas, formato, una responsabilidad por archivo).

## Resumen
Herramientas del administrador para carga masiva de datos (registros y calificaciones) y
pruebas de almacenamiento (S3).

## Roles involucrados
- **admin** — importación masiva y utilidades de storage.

## Casos de uso
- El admin importa datos de un colegio (familias/estudiantes/docentes) desde archivo.
- El admin importa calificaciones masivamente.
- Se firman subidas a S3 y se migran archivos existentes.

## Operaciones / Funciones
| Operación | Rol | Ruta | Permiso | Descripción |
|---|---|---|---|---|
| Importar datos | admin | `/admin/importar-datos` | admin | Carga masiva de registros. |
| Importar calificaciones | admin | `/admin/importar-calificaciones` | admin | Carga masiva de notas (ver [09](09-notas-y-boletas.md)). |
| Prueba S3 | admin | `/admin/prueba-s3` | admin | Test de subida a S3. |

## Rutas (frontend)
- `/admin/importar-datos`
- `/admin/importar-calificaciones`
- `/admin/prueba-s3`

## Endpoints / Edge Functions
- `import-school-data` — carga masiva de datos del colegio.
- `import-grades`, `import-bachillerato-grades` — carga de calificaciones (ver [09](09-notas-y-boletas.md)).
- `s3-sign-upload` — firma de subida a S3.
- `s3-migrate-existing` — migración de archivos existentes a S3.
- `image-proxy` — proxy de imágenes.

## Datos / Tablas (Supabase)
> ⏳ Por documentar.

## Reglas de negocio
> ⏳ Por documentar (formato de archivos, validaciones, mapeo de columnas).

## Archivos clave (código)
> ⏳ Por documentar (`src/pages/admin/...`).

## Por documentar
- Formato esperado de los archivos de importación y manejo de errores.
