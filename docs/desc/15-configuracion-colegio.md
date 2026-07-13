# Configuración del colegio

> 🧭 Al implementar cambios de este tema, sigue las [Convenciones de desarrollo](CONVENTIONS.md)
> (código en inglés, SOLID, pruebas, formato, una responsabilidad por archivo).

## Resumen
Ajustes generales del colegio: años y secciones, formularios, campos/planillas de
inscripción, ajustes de notas, carnet, plantillas de correo, configuración de pagos,
formatos y morosidad. Agrupa la sección **"Ajustes del Colegio"** del sidebar.

Este archivo es el **hub**: cada subárea tiene su detalle en el tema correspondiente.
La mayoría de estas pantallas hacen **CRUD directo a tablas vía RLS** (sin Edge Function).

## Roles involucrados
- **school** — configura su colegio (permisos `settings.school`, `forms.config`,
  `planillas.config`, `payments.config`, `payments.delinquency`, `settings.users`).

## Casos de uso
- El colegio define sus años escolares y secciones al inicio del período.
- El colegio edita los formularios de representantes/estudiantes/docentes.
- El colegio configura la planilla de inscripción (campos, secciones, firmas).
- El colegio ajusta el tipo de boleta y las escalas de notas por nivel.
- El colegio configura conceptos/planes/métodos de pago y reglas de morosidad.
- El colegio diseña los formatos de factura y boleta.

## Operaciones / Funciones
| Operación | Rol | Ruta | Componente | Permiso | Detalle |
|---|---|---|---|---|---|
| Años y secciones | school | `/school/configuraciones/anos-secciones` | `SchoolYearsSections` | `settings.school` | Ver abajo. |
| Formularios | school | `/school/configuraciones/formularios` | `FormBuilder` | `forms.config` | Ver abajo. |
| Editor de formulario | school | `/school/configuraciones/formularios/:type` | `FormFieldsEditor` | `forms.config` | `type` = `representantes` \| `estudiantes` \| `docentes`. |
| Planilla de inscripción | school | `/school/configuraciones/inscripcion-campos` | `EnrollmentDisplayConfig` | `planillas.config` | Ver [08-planillas](08-planillas.md). |
| Ajustes de notas | school | `/school/configuraciones/ajustes-notas` | `GradesSettings` | `settings.school` | Ver [09-notas](09-notas-y-boletas.md). |
| Carnet | school | `/school/configuraciones/utilidades` | `UtilitiesSettings` | `settings.school` | Ver [14-carnet](14-carnet.md). |
| Templates de correo | school | `/school/configuraciones/correos` | `EmailTemplatesList` | `settings.school` | Ver [13-correos](13-correos.md). |
| Config. pagos | school | `/pagos/configuracion` | `PaymentConfig` | `payments.config` | Ver [12-pagos](12-pagos.md). |
| Formatos | school | `/formatos` | `FormatsConfig` | `payments.config` | Factura + Boleta ([12](12-pagos.md)/[09](09-notas-y-boletas.md)). |
| Config. morosidad | school | `/pagos/morosidad` | `DelinquencyConfig` | `payments.delinquency` | Ver [12-pagos](12-pagos.md). |
| Usuarios y permisos | school | `/school/configuraciones/usuarios` | `SchoolUsersList` | `settings.users` | Ver [02-usuarios](02-usuarios-y-permisos.md). |

## Subáreas

### Años y secciones (`SchoolYearsSections`)
Define los **años escolares** (`school_years`: `year_range`, **`is_active`**) y sus
**secciones** (`sections`, con `grade_level` enum). Base de toda la estructura académica:
inscripciones, notas, asistencias y pagos se apoyan en año escolar + sección + grado.

> **Año activo:** `school_years.is_active` marca el año en curso. Muchos flujos (balances
> de pago, asignaciones, inscripciones) operan sobre el año activo (p. ej. la función
> `rebuild_student_concept_balances_for_active_year`).

### Formularios (`FormBuilder` → `FormFieldsEditor`)
Editor de los formularios que usa el colegio, en 3 tipos (`form_type`): **representantes**,
**estudiantes** y **docentes**. Cada tipo edita sus campos (`form_fields`) agrupados en
secciones (`form_field_groups`). Los valores capturados se guardan como **`form_data`
(JSON)** en `representatives` / `students` / `teachers` — por eso estos formularios definen
qué datos existen de cada persona (ver [03](03-familias-y-representantes.md),
[04](04-estudiantes.md), [05](05-docentes.md)).

Esquema de `form_fields`: `field_name`, `field_label`, `field_type` (enum `field_type`),
`form_type`, `group_id`, `field_order`, `is_required`, `is_visible`, `options` (JSON, para
selects), `placeholder`. Hay **campos protegidos** (siempre obligatorios, no eliminables).

### Planilla de inscripción (`EnrollmentDisplayConfig`)
Ver [08-planillas](08-planillas.md). Pestañas: **Modificaciones Generales**, **Modal de
Inscripción**, **Planilla de Inscripción**.

### Ajustes de notas (`GradesSettings`)
Ver [09-notas-y-boletas](09-notas-y-boletas.md). Define, por nivel (Preescolar/Primaria/
Secundaria), el **tipo de boleta/reporte** y las **escalas de calificación**.

## Rutas (frontend)
Ver tabla de Operaciones. Detalle de subtemas en:
[02-usuarios](02-usuarios-y-permisos.md), [08-planillas](08-planillas.md),
[09-notas](09-notas-y-boletas.md), [12-pagos](12-pagos.md), [13-correos](13-correos.md),
[14-carnet](14-carnet.md).

## Endpoints / Edge Functions
- Mayormente **CRUD directo a tablas vía RLS** (sin Edge Function propia).
- Subida de imágenes (logos/firmas) usa `s3-sign-upload` (ver [17](17-importacion-de-datos.md)).

## Datos / Tablas (Supabase)
- **Años/secciones:** `school_years`, `sections`.
- **Formularios:** `form_fields`, `form_field_groups`.
- **Planilla inscripción:** `enrollment_display_config`, `enrollment_planilla_sections`,
  `planilla_signature_blocks`, `planilla_general_config` (ver [08](08-planillas.md)).
- **Notas:** `grades_config`, `primary_grading_scales`, `preschool_grading_scales`
  (ver [09](09-notas-y-boletas.md)).
- **Carnet:** `carnet_config` (ver [14](14-carnet.md)).
- **Correos:** `email_templates` (ver [13](13-correos.md)).
- **Pagos:** `payment_concepts`, `payment_plans`, `payment_plan_concepts`,
  `delinquency_config` (ver [12](12-pagos.md)).
- **Formatos:** `invoice_templates`, `boleta_templates` (ver [12](12-pagos.md)/[09](09-notas-y-boletas.md)).
- **Geo (referencia):** `states`, `municipalities`, `cities`, `parishes`.

## Reglas de negocio
- Los formularios distinguen **campos protegidos** (siempre obligatorios, no eliminables).
- Toda la estructura académica cuelga de año escolar + sección + grado.
- La configuración de notas define el estilo de boleta que luego se genera (ver [09](09-notas-y-boletas.md)).

## Archivos clave (código)
- `src/pages/school/SchoolYearsSections.tsx`
- `src/pages/school/FormBuilder.tsx`, `src/pages/school/FormFieldsEditor.tsx`
- `src/pages/school/EnrollmentDisplayConfig.tsx`
- `src/pages/school/GradesSettings.tsx`
- `src/pages/school/UtilitiesSettings.tsx`
- `src/pages/school/EmailTemplatesList.tsx`
- `src/pages/school/PaymentConfig.tsx`, `src/pages/school/DelinquencyConfig.tsx`
- `src/pages/school/FormatsConfig.tsx`

## Por documentar
- Valores posibles de los enums `field_type` y `form_type`.
- Si al activar un año escolar se desactivan automáticamente los demás.
