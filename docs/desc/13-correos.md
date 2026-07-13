# Correos y plantillas

> 🧭 Al implementar cambios de este tema, sigue las [Convenciones de desarrollo](CONVENTIONS.md)
> (código en inglés, SOLID, pruebas, formato, una responsabilidad por archivo).

## Resumen
Envío de correos (masivos y transaccionales) y gestión de plantillas de correo.
El admin puede enviar correos globales; el colegio gestiona correos y sus plantillas.

## Roles involucrados
- **admin** — envío de correos globales.
- **school** — gestión de correos (permiso `emails.send`) y plantillas (`settings.school`).

## Casos de uso
- El colegio compone y envía un correo a familias usando una plantilla.
- Se envía un correo de prueba para validar la configuración.
- Se reenvía el correo de bienvenida a un usuario.

## Operaciones / Funciones
| Operación | Rol | Ruta | Permiso | Descripción |
|---|---|---|---|---|
| Enviar email | admin | `/admin/enviar-email` | admin | Envío global. |
| Gestión de correos | school | `/utilidades/correo` | `emails.send` | Composición/envío de correos. |
| Templates de correo | school | `/school/configuraciones/correos` | `settings.school` | Listado de plantillas por tipo. |
| Editor de template | school | `/school/configuraciones/correos/:type` | `settings.school` | Edición de una plantilla concreta. |

## Templates de correo (`/school/configuraciones/correos`)
Pantalla `EmailTemplatesList` ("Templates de Correo"): lista las plantillas
(`email_templates`) del colegio; cada una se edita por `:type` en `EmailTemplateEditor`
con vista previa (`src/lib/email-preview.ts`). Estas plantillas son las que usa la
**Gestión de correos** (`/utilidades/correo`) al enviar vía `send-email`.

## Rutas (frontend)
- `/admin/enviar-email`
- `/utilidades/correo`
- `/school/configuraciones/correos`
- `/school/configuraciones/correos/:type`

## Endpoints / Edge Functions
- `send-email` — envío de correos.
- `send-test-email` — correo de prueba.
- `resend-welcome-email` — reenvío de bienvenida.

## Datos / Tablas (Supabase)
- `email_templates` — plantillas de correo del colegio (por tipo).
- Envíos/log — ⏳ Por documentar.

## Reglas de negocio
> ⏳ Por documentar (variables de plantilla, proveedor de email).

## Archivos clave (código)
- `src/components/utilities/EmailComposer.tsx`
- `src/pages/school/EmailTemplatesList.tsx`, `src/pages/school/EmailTemplateEditor.tsx`
- `src/lib/email-preview.ts`

## Por documentar
- Proveedor de envío y variables disponibles en plantillas.
