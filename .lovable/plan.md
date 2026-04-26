# Plan: arreglar migración rota + errores TS

## Problema raíz

La migración `20260203180619_95aad131-1502-4e33-9e0d-e328b729d967.sql` hace `INSERT INTO form_fields` con `school_id = d743589d-6a26-474e-8cad-873909885851` (U. E. Colegio Santo Domingo de Guzmán), **pero nunca inserta primero la fila del colegio en `schools`**. En producción funcionó porque ese colegio ya existía. En cualquier BD nueva (tu Docker local) revienta con el FK violation que ves.

Los fixes de TypeScript son un problema **separado** y no resuelven esto.

## Solución

### 1. Crear nueva migración que pre-inserte el colegio (no datos personales)

Nuevo archivo: `supabase/migrations/<timestamp>_seed_default_school.sql`

Contenido — solo la fila del colegio con datos institucionales públicos (nombre, RIF, dirección, teléfono, email institucional). **Sin alumnos, familias, docentes, pagos ni notas.** Cero PII.

```sql
-- Seed: Colegio por defecto para que migraciones históricas
-- (form_fields, etc.) que referencian su id no fallen en BDs nuevas.
INSERT INTO public.schools (
  id, name, rif, address, phone, email, institution_type
) VALUES (
  'd743589d-6a26-474e-8cad-873909885851',
  'U. E. Colegio Santo Domingo de Guzmán',
  '<RIF>',
  '<dirección>',
  '<teléfono>',
  '<email institucional>',
  '<tipo>'
) ON CONFLICT (id) DO NOTHING;
```

⚠️ **Importante**: el trigger `create_default_form_fields()` se dispara al insertar el colegio y crea automáticamente los 81 form_fields default. Como la migración vieja luego hace otro INSERT de form_fields para ese mismo `school_id`, podría chocar. Hay que verificar si la migración vieja usa `ON CONFLICT DO NOTHING` o si necesitamos:
- Opción A: hacer la nueva migración con un `INSERT … ON CONFLICT DO NOTHING` y dejar que el trigger pueble. Luego eliminar/condicionar la migración vieja.
- Opción B (más segura): insertar la fila de `schools` con un guard que **no dispare el trigger** (ej. `ALTER TABLE … DISABLE TRIGGER` durante el seed), y dejar que la migración vieja siga siendo la fuente de verdad de esos campos.

Voy a inspeccionar la migración vieja completa antes de elegir y te lo confirmo al ejecutar.

Necesito que me confirmes los **datos institucionales** del colegio para poner valores reales (no placeholders) en la migración:
- RIF
- Dirección
- Teléfono
- Email institucional
- institution_type (privado / público / subvencionado)

Si prefieres, pongo valores genéricos tipo `'PENDIENTE'` y los actualizas desde la UI luego.

### 2. Arreglar los 7 errores de TypeScript de las Edge Functions

- `supabase/functions/fetch-bcv-rates/index.ts:139` → `catch (error: any)`
- `supabase/functions/get-user-emails/index.ts:113` → narrowing: `userResults.filter((u): u is NonNullable<typeof u> => u !== null)`
- `supabase/functions/main/index.ts:27` → `catch (error: any)`
- `supabase/functions/record-attendance/index.ts:263` → `catch (error: any)`
- `supabase/functions/send-email/index.ts:96` → `await client.send(mailConfig as any)`
- `supabase/functions/send-email/index.ts:106` → `catch (error: any)`

### 3. Memoria del proyecto

Guardar `mem://constraints/no-orphan-school-references` con la regla: cualquier migración que inserte filas con FK a `schools` debe primero asegurar que la fila del colegio existe (o usar el script `seed-from-production.sh`).

## Lo que NO hago

- No meto alumnos/familias/docentes/pagos en migraciones (PII, LOPNNA, repo bloat).
- No toco el script `seed-from-production.sh` — sigue siendo la vía para datos reales en local.

## Resultado esperado

- `bash scripts/seed-from-production.sh` (o solo aplicar migraciones en Docker) corre limpio sin FK violation.
- `supabase functions deploy` compila sin los 7 errores TS.
