# Planillas

> 🧭 Al implementar cambios de este tema, sigue las [Convenciones de desarrollo](CONVENTIONS.md)
> (código en inglés, SOLID, pruebas, formato, una responsabilidad por archivo).

## Resumen
Generación y configuración de planillas (formatos de datos/listados) del colegio.

## Roles involucrados
- **school** — genera y configura planillas (permiso `planillas.config`).
- **representative** — puede descargar la planilla de inscripción de sus estudiantes
  (lectura de config vía RLS; ver migraciones de políticas en
  `enrollment_planilla_sections` y `planilla_general_config`).

## Casos de uso
- El colegio configura la **planilla de inscripción**: qué campos se muestran, en qué
  secciones, con qué firmas y cabecera.
- El colegio ajusta el **modal de inscripción** (campos visibles al inscribir).
- Se genera/imprime la planilla de inscripción de un estudiante con ese formato.
- El **representante** descarga la planilla desde **Mis Estudiantes**
  (`/representative/estudiantes` → menú Descargas → Planilla de Inscripción), con el
  mismo comportamiento que el colegio: sin bloqueo por campos opcionales vacíos.

## Configuración de Planillas (`/school/configuraciones/inscripcion-campos`)
Pantalla `EnrollmentDisplayConfig` ("Configuración de Planillas") con **3 pestañas**:
- **Modificaciones Generales** — ajustes globales de presentación.
- **Modal de Inscripción** — qué campos (`form_fields`) se muestran/ocultan en el modal
  de inscripción y su comportamiento.
- **Planilla de Inscripción** — armado de la planilla imprimible: secciones
  (`enrollment_planilla_sections`), bloques de firma (`planilla_signature_blocks`) y
  configuración general de la planilla (`planilla_general_config`, ej. cabecera/logo).

> Nota: las **líneas de firma** de algunas boletas (estilo `simple`) también se toman de
> aquí (Planillas → Configuración General) — ver [09-notas](09-notas-y-boletas.md).

## Operaciones / Funciones
| Operación | Rol | Ruta | Permiso | Descripción |
|---|---|---|---|---|
| Planillas | school | `/planillas` | `planillas.config` | Generación de planillas (sábana, resumen final, etc.). |
| Config. planillas | school | `/school/configuraciones/inscripcion-campos` | `planillas.config` | Campos/estructura de la planilla de inscripción. |
| Descargar planilla inscripción | school | `/inscripciones` | `enrollments.view` | PDF por estudiante desde menú de acciones. |
| Descargar planilla inscripción | representative | `/representative/estudiantes` | — | PDF por estudiante desde menú Descargas. |

## Rutas (frontend)
- `/planillas`
- `/school/configuraciones/inscripcion-campos` (pestañas: Generales / Modal / Planilla)
- `/inscripciones` (descarga school)
- `/representative/estudiantes` (descarga representative)

## Endpoints / Edge Functions
- CRUD directo a tablas vía RLS. Subida de imágenes vía `s3-sign-upload`.
- Generación PDF planilla inscripción: cliente (`downloadPlanillaInscripcion`).

## Datos / Tablas (Supabase)
- `enrollment_display_config` — configuración de visualización de la inscripción.
- `enrollment_planilla_sections` — secciones de la planilla de inscripción.
- `planilla_signature_blocks` — bloques/líneas de firma.
- `planilla_general_config` — configuración general (cabecera, logo, etc.).
- `form_fields` — campos disponibles (compartidos con Formularios, ver [15](15-configuracion-colegio.md)).
- Geo (referencia): `states`, `municipalities`, `cities`, `parishes`.

## Reglas de negocio
- La planilla se arma a partir de `form_fields` + secciones + firmas configuradas.
- Las líneas de firma configuradas aquí se reutilizan en boletas estilo `simple`.
- La descarga no exige que todos los campos de la planilla estén llenos; los vacíos se
  muestran como `"No registrado"` en el PDF.

## Archivos clave (código)
- `src/pages/school/EnrollmentDisplayConfig.tsx`
- `src/pages/school/EnrollmentsList.tsx` — descarga planilla (school)
- `src/pages/representative/StudentsList.tsx` — descarga planilla (representative)
- `src/lib/export-utils.ts` — `downloadPlanillaInscripcion`
- `src/components/planilla/...`, `src/components/planillas/...`

## Por documentar
- Diferencia exacta entre `/planillas` (generación) y la config de inscripción.
- Esquema de `enrollment_display_config` y de las secciones/firmas.
