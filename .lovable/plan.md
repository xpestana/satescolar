

# Migración de archivos a AWS S3 (conexión manual con secretos)

## Objetivo
Mover **todas** las subidas de archivos a un bucket S3 propio de AWS usando credenciales manuales (no el conector de Lovable), organizando las carpetas **por colegio**.

## Inventario de subidas

| # | Origen | Tipo de archivo | Bucket actual |
|---|--------|-----------------|---------------|
| 1 | `AddStudent.tsx` | Foto estudiante | `family-photos` |
| 2 | `AddRepresentative.tsx` | Foto representante | `family-photos` |
| 3 | `AddTeacher.tsx` | Foto docente | `family-photos` |
| 4 | `RepAddStudent.tsx` | Foto estudiante (rol representante) | `family-photos` |
| 5 | `RepAddRepresentative.tsx` | Foto representante (rol representante) | `family-photos` |
| 6 | `SchoolForm.tsx` | Logo del colegio | `school-logos` |
| 7 | `UtilitiesSettings.tsx` | Marca de agua / assets de carnet | `school-assets` |
| 8 | **Nuevo** `StreamFeed.tsx` | Adjuntos en publicaciones del aula | (no existe UI) |
| 9 | **Nuevo** `ActivityFormModal.tsx` | Adjuntos en actividades | (no existe UI) |
| 10 | **Nuevo** `SubmissionReview.tsx` | Adjuntos en entregas de estudiantes | (no existe UI) |

## Estructura de carpetas en S3 (separada por colegio)

```text
s3://<bucket>/
  └── schools/
        └── <school_id>/
              ├── logo/<timestamp>.png
              ├── assets/<filename>          (marca de agua, etc.)
              ├── students/<student_id>/<timestamp>.png
              ├── representatives/<family_id>/<timestamp>.png
              ├── teachers/<teacher_id>/<timestamp>.png
              └── classroom/<classroom_id>/
                    ├── posts/<post_id>/<timestamp>-<filename>
                    ├── activities/<activity_id>/<timestamp>-<filename>
                    └── submissions/<submission_id>/<timestamp>-<filename>
```

Ventajas: aislamiento por institución, fácil de auditar/respaldar/borrar, URLs auto-descriptivas.

## Arquitectura técnica (sin gateway de Lovable)

```text
Frontend → edge function `s3-sign-upload` (firma SigV4 manual con AWS keys)
        → devuelve URL pre-firmada PUT
Frontend → PUT directo a S3 → URL pública guardada en BD
```

- **Secretos requeridos** (los pediré con `add_secret` al iniciar):
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_REGION` (ej. `us-east-1`)
  - `AWS_S3_BUCKET` (nombre del bucket)

- **Edge functions nuevas** (con `verify_jwt = false` y validación manual del JWT del usuario):
  - `s3-sign-upload` — recibe `{ folder, fileName, contentType, schoolId, entityId }`, valida sesión, construye `object_path = schools/<schoolId>/<folder>/<entityId>/<timestamp>-<fileName>`, firma una URL PUT con SigV4 (15 min de validez) y la devuelve junto con la URL pública final.
  - `s3-migrate-existing` — script ejecutable bajo demanda desde el panel admin: recorre los buckets actuales (`family-photos`, `school-logos`, `school-assets`), detecta el `school_id` de cada archivo, lo sube a S3 al prefijo correcto y actualiza la URL en BD. Idempotente (salta URLs ya migradas).

- **Helper frontend nuevo:** `src/lib/s3-upload.ts` con `uploadToS3({ file, folder, schoolId, entityId })` que:
  1. Llama a `s3-sign-upload` vía `supabase.functions.invoke`.
  2. Hace `fetch(PUT, file)` directo a S3.
  3. Devuelve la URL pública.

- **Librería de firma SigV4:** usaremos `aws4fetch` (compatible con Deno, ligera, sin dependencias) en las edge functions.

## UI nueva del Aula Virtual

1. **`StreamFeed.tsx`** — botón "Adjuntar archivo" en el composer de publicaciones; chips con archivos por post.
2. **`ActivityFormModal.tsx`** — sección "Materiales adjuntos" al crear/editar actividad.
3. **`SubmissionReview.tsx`** — los estudiantes adjuntan su entrega (PDF, imagen, doc); el docente las descarga.

Cada adjunto guarda en BD: `file_url`, `file_name`, `file_size`, `mime_type`, `uploaded_by`, `created_at`.

## Migración de archivos existentes

Edge function `s3-migrate-existing` con botón "Migrar archivos a S3" en el panel admin:
- Recorre `family-photos`, `school-logos`, `school-assets`, `classroom-files`.
- Por cada archivo:
  1. Determina el `school_id` (vía `students.school_id`, `family_schools`, `teachers.school_id`, `schools.id`).
  2. Descarga del bucket Supabase.
  3. Sube a S3 al prefijo `schools/<school_id>/...`.
  4. Actualiza la URL correspondiente en la tabla.
- Idempotente: salta URLs que ya empiecen con el dominio S3.
- Reporta progreso (procesados / total / errores).

## Tablas nuevas (migración SQL)

- `classroom_post_attachments` (post_id, file_url, file_name, file_size, mime_type, uploaded_by, created_at) + RLS por colegio.
- `classroom_submission_attachments` (submission_id, file_url, file_name, file_size, mime_type, uploaded_by, created_at) + RLS por colegio.
- `classroom_activity_attachments` ya existe — solo verificar RLS.

## Detalles técnicos

- **Acceso público:** los objetos se suben con ACL `public-read` (header `x-amz-acl: public-read` en el PUT firmado). El bucket debe permitirlo.
- **CORS del bucket S3** (lo configura el usuario en consola AWS):
  ```json
  [{"AllowedOrigins":["*"],"AllowedMethods":["PUT","GET","HEAD"],"AllowedHeaders":["*"],"ExposeHeaders":["ETag"]}]
  ```
- **Política IAM mínima** del usuario IAM dueño de las keys:
  ```json
  {"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["s3:PutObject","s3:PutObjectAcl","s3:GetObject","s3:DeleteObject","s3:ListBucket"],"Resource":["arn:aws:s3:::<bucket>","arn:aws:s3:::<bucket>/*"]}]}
  ```
- **Buckets Supabase actuales:** se mantienen hasta confirmar migración exitosa; luego se vacían manualmente.

## Pasos de implementación

1. Pedir los 4 secretos AWS con `add_secret`.
2. Crear edge function `s3-sign-upload` (con `aws4fetch`) + helper `src/lib/s3-upload.ts`.
3. Reemplazar las 7 subidas existentes por `uploadToS3` con el `schoolId` correcto.
4. Migración SQL para tablas de adjuntos del aula virtual.
5. Construir UI de adjuntos en `StreamFeed`, `ActivityFormModal`, `SubmissionReview`.
6. Crear edge function `s3-migrate-existing` + botón en panel admin.
7. Probar el flujo completo (subida nueva + migración + descarga).

## Lo que el usuario debe hacer

- Proporcionar `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET`.
- Configurar CORS en el bucket S3 (JSON arriba).
- Confirmar que el bucket permite objetos `public-read` (desactivar "Block all public access" o ajustar según necesidad).
- Verificar que el usuario IAM tiene la política mínima listada arriba.

