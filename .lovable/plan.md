# Plan: Administradores + eliminar seeder admin local

## 1. Arreglar edge functions del módulo Administradores

Las funciones `create-system-admin`, `update-system-admin`, `delete-user` y `suspend-user` validan al usuario solicitante con `supabaseAdmin.auth.getUser(token)`. Ese método solo funciona con JWTs HS256 (legacy). El proyecto está en modo signing-keys (ES256), donde el patrón obligatorio es `supabaseUser.auth.getClaims(token)` (regla guardada en memoria del proyecto). Ese desfase explica por qué editar/crear/suspender/eliminar admins puede fallar con "Token inválido" o "No autorizado" en producción.

**Cambio en las 4 funciones**:
- Crear cliente `supabaseUser` con la `Authorization` header y `SUPABASE_ANON_KEY`.
- Reemplazar `supabaseAdmin.auth.getUser(token)` por `supabaseUser.auth.getClaims(token)` y leer `claimsData.claims.sub` como `requestingUserId`.
- Mantener el resto del flujo (verificación de rol admin con `supabaseAdmin`, operaciones de mutación) sin cambios.

## 2. Modal de edición: mostrar datos guardados

El modal hoy ya hace fetch de `profiles` y de email vía `get-user-emails` cuando se abre, pero el `useEffect` solo aplica los valores si los campos del usuario en la lista vienen vacíos. Si la fila ya trae `full_name` o `phone`, no se sobreescribe; el problema reportado ("no muestra los datos guardados") ocurre cuando `phone` viene `null` o el correo se pierde por el fallo de auth en `get-user-emails`.

**Cambios en `src/pages/admin/AdminUsersList.tsx`**:
- En `openEditDialog`, usar siempre los valores del row como base (ya lo hace).
- En el `useEffect` de hidratación, **siempre** aplicar los datos frescos de `profiles` (`full_name`, `phone`) y del `get-user-emails` (`email`), sin condicionar a "vacío". Esto garantiza que el modal refleje el último estado guardado en BD.
- Como respaldo, si `get-user-emails` falla, usar `userToEdit.email` actual.

Una vez que la edge function `get-user-emails` autentica bien (ya está OK con `getClaims`) y `update-system-admin` queda corregida, el ciclo "guardar → recargar lista → reabrir modal" mostrará los datos correctos.

## 3. Eliminar el seeder de admin local

El seed automático de `admin@local.test` no se está aplicando bien al levantar Docker; el usuario lo creará a mano desde Studio.

**Eliminar**:
- Archivo `scripts/seeds/late/01_seed_admin_user.sql`.
- Carpeta `scripts/seeds/late/` (queda vacía).
- Variables `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD`, `ADMIN_SEED_NAME` y su sección "Primer admin" en `.env.example`.
- Bloque `ADMIN_SEED_*` en `docker-compose.yml` (líneas 100-102 del servicio `sat-migrations`).
- Función `apply_late_seeds` y sus llamadas en `scripts/run-migrations.sh` y `scripts/import-to-local.sh` (también la variable `LATE_DIR`).
- Memoria `mem://project/local-seeds-bootstrap`: actualizar para reflejar que ya no hay late seeds y el admin se crea manualmente desde Studio. Actualizar la línea correspondiente en `mem://index.md`.

Los **early seeds** (`scripts/seeds/early/00_seed_schools.sql`) se mantienen tal cual; solo se elimina la fase "late".

## Detalles técnicos

Patrón de auth correcto a aplicar en las 4 functions:

```ts
const supabaseUser = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  { global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false } }
);
const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
const requestingUserId = claimsData?.claims?.sub;
if (claimsError || !requestingUserId) return 401;
```

Después se sigue usando `supabaseAdmin` (service role) para verificar el rol y ejecutar `auth.admin.*` y updates en `profiles`.

## Archivos afectados

- `supabase/functions/create-system-admin/index.ts` (auth)
- `supabase/functions/update-system-admin/index.ts` (auth)
- `supabase/functions/delete-user/index.ts` (auth)
- `supabase/functions/suspend-user/index.ts` (auth)
- `src/pages/admin/AdminUsersList.tsx` (hidratación del modal)
- `scripts/seeds/late/01_seed_admin_user.sql` (eliminar)
- `scripts/run-migrations.sh` (quitar late seeds)
- `scripts/import-to-local.sh` (quitar late seeds)
- `docker-compose.yml` (quitar env ADMIN_SEED_*)
- `.env.example` (quitar sección Primer admin)
- `mem://project/local-seeds-bootstrap` y `mem://index.md` (actualizar)
