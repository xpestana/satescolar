

# Migración a AWS S3 con organización por colegio

## Objetivo
Mover todas las subidas de archivos a un bucket S3 de AWS, organizando las carpetas **por colegio** para mantener todo aislado y fácil de auditar.

## Inventario de subidas actuales

| # | Origen | Tipo de archivo |
|---|--------|-----------------|
| 1 | `AddStudent.tsx` | Foto estudiante |
| 2 | `AddRepresentative.tsx` | Foto representante |
| 3 | `AddTeacher.tsx` | Foto docente |
| 4 | `RepAddStudent.tsx` | Foto estudiante (rol representante) |
| 5 | `RepAddRepresentative.tsx` | Foto representante (rol representante) |
| 6 | `SchoolForm.tsx` | Logo del colegio |
| 7 | `UtilitiesSettings.tsx` | Marca de agua / assets de carnet |
| 8 | **Nuevo** `StreamFeed.tsx` | Adjuntos en publicaciones del aula |
| 9 | **Nuevo** `ActivityFormModal.tsx` | Adjuntos en actividades |
| 10 | **Nuevo** `SubmissionReview.tsx` | Adjuntos en entregas de estudiantes |

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

Ventajas:
- Todo lo de un colegio queda bajo un solo prefijo → fácil de auditar, respaldar o eliminar.
- Las URLs revelan el contexto (colegio + tipo + entidad).
- Aislamiento natural entre instituciones.

## Arquitectura técnica

```text
Frontend → edge function `s3-sign-upload` → AWS gateway de Lovable → URL firmada PUT
Frontend → PUT directo a S3 → URL pública guardada en BD
```

- **Conector usado**: `aws_s3` de Lovable (gateway oficial). Maneja la firma SigV4 automáticamente. Solo hace falta tener configurada la conexión con `scopes` que incluyan `write`.
- **Edge functions nuevas**:
  - `s3-sign-upload` — recibe `{ folder, fileName, contentType, schoolId }`, valida sesión del usuario, construye la `object_path` con el prefijo `schools/<school_id>/...`, devuelve URL firmada PUT.
  - `s3-migrate-existing` — ejecutable bajo demanda desde panel admin: recorre buckets actuales (`family-photos`, `school-logos`, `school-assets`), descarga cada archivo, lo sube a S3 al prefijo del colegio correspondiente y actualiza URLs en BD.
- **Helper frontend**: `src/lib/s3-upload.ts` con `uploadToS3({ file, folder, schoolId, entityId })`.

## UI nueva del Aula Virtual

1. **`StreamFeed.tsx`** — botón "Adjuntar archivo" en composer de posts; chips con archivos del post.
2. **`ActivityFormModal.tsx`** — sección "Materiales adjuntos" al crear/editar actividad.
3. **`SubmissionReview.tsx`** — los estudiantes adjuntan su entrega; el docente la descarga.

Cada adjunto guarda en BD: `file_url`, `file_name`, `file_size`, `mime_type`, `uploaded_by`, `created_at`.

## Migración de archivos existentes

Edge function `s3-migrate-existing` con botón en el panel admin:
- Recorre buckets Supabase y para cada archivo:
  1. Detecta a qué colegio pertenece (vía `student.school_id`, `representative.family_id → family_schools`, `teacher.school_id`, `school.id`).
  2. Descarga del bucket Supabase.
  3. Sube a S3 al prefijo `schools/<school_id>/...`.
  4. Actualiza la URL en la tabla correspondiente.
- **Idempotente**: salta URLs que ya empiezan con dominio S3.
- Reporta progreso (procesados / total / errores).

## Detalles técnicos

- **Conexión S3**: usar el conector oficial `aws_s3` de Lovable (más seguro que secretos manuales). El usuario lo conecta una vez y el gateway maneja la autenticación.
- **Permisos del bucket**: archivos públicos (URL directa, igual que hoy). El bucket debe tener política `public-read` y CORS abierto para PUT/GET desde el dominio de la app.
- **Tablas nuevas** vía migración SQL: `classroom_post_attachments`, `classroom_submission_attachments` con RLS por colegio. `classroom_activity_attachments` ya existe — solo verificar RLS.
- **Buckets Supabase actuales**: se mantienen hasta confirmar que la migración terminó bien; luego se vacían manualmente.

## Pasos de implementación (en orden)

1. Conectar el conector `aws_s3` (te lanzo el flujo de conexión con `scopes: read, write`).
2. Crear edge function `s3-sign-upload` + helper `src/lib/s3-upload.ts`.
3. Reemplazar las 7 subidas existentes por `uploadToS3` con el `schoolId` correcto.
4. Migración SQL para tablas de adjuntos del aula virtual.
5. Construir UI de adjuntos en `StreamFeed`, `ActivityFormModal`, `SubmissionReview`.
6. Crear edge function `s3-migrate-existing` + botón en panel admin.
7. Probar flujo completo (subida nueva + migración + descarga).

## Lo que el usuario debe hacer

- Aprobar la conexión del conector AWS S3 (te pediré el bucket name, region, access key, secret).
- Configurar CORS en el bucket S3 (te paso el JSON exacto):
  ```json
  [{"AllowedOrigins":["*"],"AllowedMethods":["PUT","GET"],"AllowedHeaders":["*"]}]
  ```
- Confirmar que el bucket tiene política `public-read` para los objetos.

