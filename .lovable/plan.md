
## Problema

En tu VPS Ubuntu, **todas** las edge functions entran por `supabase/functions/main/index.ts`, que las carga con `import(\`../${functionName}/index.ts\`)` dinámico. El edge-runtime de Docker falla con ese import dinámico en muchas funciones, devolviendo:

```
Function 'delete-user' not found: Module not found: ...
```

Ya lo arreglamos para `create-system-admin` y `update-system-admin` con dos cambios:
1. Reemplazar `serve(handler)` por `export default async function handler(req)`.
2. Registrarlas en el `staticHandlers` de `main/index.ts` (import estático).

Faltan **17 funciones** con el mismo problema:

```
create-admin-user            resend-welcome-email
create-family                s3-migrate-existing
create-teacher               s3-sign-upload
delete-user                  send-delinquency-reminders
fetch-bcv-rates              send-email
get-user-emails              suspend-user
impersonate-user             update-family-email
record-attendance            update-family-password
                             update-teacher-password
```

## Cambios a aplicar

### 1. Cada una de las 17 funciones (`supabase/functions/<name>/index.ts`)

- Quitar `import { serve } from "https://deno.land/std@.../http/server.ts"`.
- Cambiar `serve(async (req) => { ... })` por:
  ```ts
  export default async function handler(req: Request): Promise<Response> {
    ...
  }
  ```
- Si el handler ya estaba como función nombrada y se pasaba a `serve(handler)`, eliminar el `serve(...)` y exportar el handler como `default`.
- No tocar la lógica interna (CORS, validación de JWT, queries, etc.).

### 2. `supabase/functions/main/index.ts`

Agregar imports estáticos y entradas en `staticHandlers` para las 17 funciones, manteniendo las dos ya registradas. Queda así (resumen):

```ts
import createAdminUser from "../create-admin-user/index.ts";
import createFamily from "../create-family/index.ts";
import createSystemAdmin from "../create-system-admin/index.ts";
import createTeacher from "../create-teacher/index.ts";
import deleteUser from "../delete-user/index.ts";
import fetchBcvRates from "../fetch-bcv-rates/index.ts";
import getUserEmails from "../get-user-emails/index.ts";
import impersonateUser from "../impersonate-user/index.ts";
import recordAttendance from "../record-attendance/index.ts";
import resendWelcomeEmail from "../resend-welcome-email/index.ts";
import s3MigrateExisting from "../s3-migrate-existing/index.ts";
import s3SignUpload from "../s3-sign-upload/index.ts";
import sendDelinquencyReminders from "../send-delinquency-reminders/index.ts";
import sendEmail from "../send-email/index.ts";
import suspendUser from "../suspend-user/index.ts";
import updateFamilyEmail from "../update-family-email/index.ts";
import updateFamilyPassword from "../update-family-password/index.ts";
import updateSystemAdmin from "../update-system-admin/index.ts";
import updateTeacherPassword from "../update-teacher-password/index.ts";

const staticHandlers: Record<string, (req: Request) => Promise<Response>> = {
  "create-admin-user": createAdminUser,
  "create-family": createFamily,
  "create-system-admin": createSystemAdmin,
  "create-teacher": createTeacher,
  "delete-user": deleteUser,
  "fetch-bcv-rates": fetchBcvRates,
  "get-user-emails": getUserEmails,
  "impersonate-user": impersonateUser,
  "record-attendance": recordAttendance,
  "resend-welcome-email": resendWelcomeEmail,
  "s3-migrate-existing": s3MigrateExisting,
  "s3-sign-upload": s3SignUpload,
  "send-delinquency-reminders": sendDelinquencyReminders,
  "send-email": sendEmail,
  "suspend-user": suspendUser,
  "update-family-email": updateFamilyEmail,
  "update-family-password": updateFamilyPassword,
  "update-system-admin": updateSystemAdmin,
  "update-teacher-password": updateTeacherPassword,
};
```

El fallback dinámico `import(\`../${functionName}/index.ts\`)` se queda por compatibilidad (Lovable Cloud y futuras funciones), pero ya nada del repo dependerá de él.

## Compatibilidad con Lovable Cloud

El `export default` no rompe Lovable Cloud: la nube despliega cada función por su cuenta y solo necesita que el archivo levante un servidor **o** exporte un handler. Como además mantenemos `main/index.ts`, en local sigue todo enrutado por ahí.

Si en algún caso Lovable Cloud requiriera un `serve()` explícito, lo agregamos al final del archivo así:
```ts
if (import.meta.main) Deno.serve(handler);
```
(Lo evaluamos por función si aparece algún warning al desplegar; por ahora el patrón actual ya probado en `create-system-admin` / `update-system-admin` funciona en ambos entornos.)

## Pasos en tu VPS después del deploy

```bash
cd ~/satescolar
git pull
docker compose restart supabase-functions
```

Con eso quedan operativas todas las funciones (delete-user, impersonate-user, create-teacher, send-email, etc.) sin más errores de "Module not found".

## Riesgos

- Cambio mecánico y repetitivo → bajo riesgo de bugs lógicos.
- Algunas funciones (`fetch-bcv-rates`, `send-delinquency-reminders`) podrían ejecutarse vía cron — el handler exportado sigue respondiendo igual a un `POST`, así que el cron las puede seguir invocando vía HTTP sin cambios.
