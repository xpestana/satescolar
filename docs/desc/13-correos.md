# Correos y plantillas

> 🧭 Al implementar cambios de este tema, sigue las [Convenciones de desarrollo](CONVENTIONS.md)
> (código en inglés, SOLID, pruebas, formato, una responsabilidad por archivo).
>
> 📦 **Módulo:** `messaging` (Mensajes Masivos) para `/utilidades/correo`; las plantillas son Registro. Ver [19-modulos](19-modulos.md).

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
- **Proveedor:** SMTP (Mailgun) vía `_shared/smtp-client.ts`.
- **Bienvenida** (alta de familia, docente, sub-usuario y dueño; reenvíos): siempre por
  `_shared/welcome-email.ts` → `sendWelcomeEmail`. Usa la plantilla del colegio (`welcome-family` /
  `welcome-teacher`, **asunto y cuerpo**) o la por defecto. Variables: `{{nombre_colegio}}`,
  `{{email_usuario}}`, `{{contrasena}}`, `{{url_plataforma}}`, `{{primary_color}}`. El armado es puro
  (`welcome-email-content.ts`, con pruebas).
- **El correo nunca deshace el alta:** se espera el envío y la función responde
  `{ email_sent, email_error }`; la pantalla muestra la contraseña si no salió. Si el alta falla a
  medias (usuario creado pero no la familia/docente/rol), la función deshace lo que creó.
- **Reenviar bienvenida** revisa la configuración SMTP **antes** de cambiar la contraseña y siempre
  devuelve la nueva contraseña.
- **Usuarios existentes:** se buscan con `findUserByEmail` (`_shared/authUsers.ts`, paginado);
  `listUsers()` sin paginar solo ve 50 cuentas.
- **Rol del que llama:** `getCallerRole` (`_shared/callerRole.ts`) filtra por los roles permitidos;
  nunca `.single()` sobre `user_roles` (un usuario puede tener varios roles).
- **Correo masivo** (`send-email`): varios destinatarios van en **BCC** en tandas de 50 (el `To:`
  visible es el remitente); el personal del colegio necesita el permiso `emails.send`.
- **Morosidad** (`send-delinquency-reminders`): solo con JWT de service role (cron); envía directo por
  SMTP (no a través de `send-email`).
- **Errores en el frontend:** llamar a las funciones con `invokeEdgeFunction` (`src/lib`), que muestra
  el mensaje en español de la función en vez del genérico "non-2xx status code" de supabase-js.

## Archivos clave (código)
- `src/components/utilities/EmailComposer.tsx`
- `src/pages/school/EmailTemplatesList.tsx`, `src/pages/school/EmailTemplateEditor.tsx`
- `src/lib/email-preview.ts`

## Módulo `messaging`
- `/utilidades/correo` va envuelta en `<ModuleRoute module="messaging">`.
- `send-email` responde **403** `{ status: "module_inactive" }` a usuarios `school` cuyo colegio no
  tiene el módulo. El admin (`/admin/enviar-email`) nunca se bloquea.
- Las plantillas (`/school/configuraciones/correos`) siguen en Registro: alimentan correos
  transaccionales (bienvenida, morosidad).

## Por documentar
- Proveedor de envío y variables disponibles en plantillas.
