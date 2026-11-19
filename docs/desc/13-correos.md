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
Pantalla `EmailTemplatesList` ("Templates de Correo"): lista los 5 tipos del catálogo
(`welcome-family`, `welcome-teacher`, `welcome-staff`, `delinquency`, `payment-reminder`) y
marca "Personalizado" / "Por defecto". Cada uno se edita por `:type` en `EmailTemplateEditor`.
"Recordatorio de Cuotas" (`payment-reminder`) lleva la marca **Próximamente**: se puede editar pero
ningún proceso lo envía todavía. La vista previa usa el mismo render que el envío real.

## Arquitectura de envío (`supabase/functions/_shared/email/`)
Un solo camino para todos los correos (bienvenidas, masivo, prueba, morosidad, asistencia, recibo y
reporte de nómina, comprobante de retención):

| Archivo | Responsabilidad |
|---|---|
| `templates.ts` | **Catálogo único**: por tipo, etiqueta, descripción, asunto y cuerpo por defecto, variables (snippets) y datos de ejemplo. Lo usan las funciones y el editor. |
| `layout.ts` | Diseño del correo (cabecera con colores y logo del colegio, pie SAT Escolar) y `escapeHtml`. |
| `render.ts` | `renderEmailTemplate`: reemplaza `{{variables}}` **escapando** los valores (salvo las marcadas `html`, p. ej. `conceptos_pendientes`) y envuelve en el layout. |
| `schoolTemplates.ts` | Carga la plantilla activa del colegio (o la por defecto) y su marca; `renderSchoolEmail`. |
| `mailerCore.ts` / `mailer.ts` | **Único envío**: valida SMTP, remitente, cabeceras sin rastreo, asunto en ASCII, BCC, adjuntos y timeout. Nunca lanza: devuelve `{ sent, error }`. |
| `welcome.ts`, `delinquency.ts`, `attendance.ts`, `batch.ts` | Variables y destinatarios de cada caso; envío en lotes con tiempo límite. |

- `src/lib/email-preview.ts` y el editor importan `templates.ts` y `render.ts` directamente.
- **Asuntos en ASCII:** el cliente SMTP compartido + denomailer codifican dos veces los asuntos con
  acentos (RFC 2047) y Gmail muestra `=?utf-8?b?...?=`; el mailer quita acentos a todos los asuntos.

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
- `email_templates` — plantillas de correo del colegio (por tipo; CHECK con los 5 tipos del catálogo,
  `welcome-staff` desde `20261119120000_email_templates_welcome_staff.sql`).
- Envíos/log — ⏳ Por documentar.

## Reglas de negocio
- **Proveedor:** SMTP (Mailgun) vía `_shared/smtp-client.ts`, solo a través de `_shared/email/mailer.ts`.
- **Bienvenida** (alta de familia, docente, personal del colegio y dueño; reenvíos; importación
  opcional): `_shared/welcome-email.ts` → `sendWelcomeEmail`, con la plantilla del rol
  (`welcome-family` / `welcome-teacher` / `welcome-staff`, asunto y cuerpo). Variables:
  `{{nombre_colegio}}`, `{{email_usuario}}`, `{{contrasena}}`, `{{url_plataforma}}`,
  `{{primary_color}}` y, en personal, `{{nombre_usuario}}` y `{{rol_usuario}}`.
- **El correo nunca deshace el alta:** se espera el envío y la función responde
  `{ email_sent, email_error }`; la pantalla muestra la contraseña si no salió. Si el alta falla a
  medias (usuario creado pero no la familia/docente/rol), la función deshace lo que creó.
- **Reenviar bienvenida** revisa la configuración SMTP **antes** de cambiar la contraseña y siempre
  devuelve la nueva contraseña.
- **Importación** (`import-school-data`): con `send_welcome: true` envía la bienvenida a las cuentas
  **nuevas** en lotes de 4 durante máx. 90 s; informa enviados, fallidos y pendientes.
- **Usuarios existentes:** se buscan con `findUserByEmail` (`_shared/authUsers.ts`, paginado);
  `listUsers()` sin paginar solo ve 50 cuentas.
- **Rol del que llama:** `getCallerRole` (`_shared/callerRole.ts`) filtra por los roles permitidos;
  nunca `.single()` sobre `user_roles` (un usuario puede tener varios roles).
- **`get-user-emails`:** el admin ve cualquier cuenta; un usuario del colegio solo las de su colegio
  (rol en el colegio, docente del colegio o familia asociada; `_shared/userEmailScope.ts`).
- **Destinatarios "Familias"** del correo masivo: el correo de la **cuenta** de la familia (el que se ve
  en Familias) y, si falta, el del representante principal (`useFamilyEmailRecipients` +
  `src/lib/email/familyRecipients.ts`).
- **Correo masivo** (`send-email`): varios destinatarios van en **BCC** en tandas de 50 (el `To:`
  visible es el remitente); el personal del colegio necesita el permiso `emails.send`.
- **Morosidad** (`send-delinquency-reminders`): solo con JWT de service role (cron). Un correo por
  estudiante moroso, dirigido a la cuenta de la familia **y** a cada representante con correo
  (columna `email` o `correo_electronico` del formulario), sin duplicados; `email_sent_to` guarda la lista.
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
