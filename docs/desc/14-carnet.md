# Carnet

> 🧭 Al implementar cambios de este tema, sigue las [Convenciones de desarrollo](CONVENTIONS.md)
> (código en inglés, SOLID, pruebas, formato, una responsabilidad por archivo).

## Resumen
Generación e impresión del carnet estudiantil/docente (con QR usado en asistencias) y su
configuración de diseño.

## Roles involucrados
- **teacher** — accede a su carnet.
- **school** — configura el carnet (permiso `settings.school`).

## Casos de uso
- El docente visualiza/imprime su carnet con QR.
- El colegio configura el diseño del carnet (por año escolar) en `/school/configuraciones/utilidades`.

## Configuración de Carnet (`/school/configuraciones/utilidades`)
Pantalla `UtilitiesSettings` ("Utilidades" → "Configuración de Carnet"): diseño del carnet
guardado en `carnet_config`. Toma datos del colegio (`schools`) y del año escolar
(`school_years`). Las imágenes (logo/fondo) se suben a S3.

## Operaciones / Funciones
| Operación | Rol | Ruta | Permiso | Descripción |
|---|---|---|---|---|
| Carnet docente | teacher | `/teacher/carnet` | — | Carnet del docente. |
| Config. carnet | school | `/school/configuraciones/utilidades` | `settings.school` | Diseño/utilidades de carnet. |

## Rutas (frontend)
- `/teacher/carnet`
- `/school/configuraciones/utilidades`

## Endpoints / Edge Functions
- `image-proxy` — posible proxy de imágenes (logo/foto) para el carnet. ⏳ verificar uso.

## Datos / Tablas (Supabase)
- `carnet_config` — configuración de diseño del carnet (por colegio/año escolar).
- Referencia: `schools`, `school_years`.

## Reglas de negocio
- El QR del carnet se usa en [10-asistencias](10-asistencias.md).

## Archivos clave (código)
- `src/pages/school/UtilitiesSettings.tsx` (configuración de carnet)
- `src/components/utilities/CarnetPreview.tsx`

## Por documentar
- Contenido/campos del carnet y formato del QR.
