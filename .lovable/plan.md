

# Plan: Docker + Docker Compose para desarrollo local completo

## Qué se creará

### 1. `Dockerfile` (Frontend React)
- Multi-stage build: `node:20-alpine` para build, `nginx:alpine` para servir
- Variables `VITE_*` como build args inyectadas desde `.env`

### 2. `docker-compose.yml`
Servicios:
- **`app`** — Frontend React (Nginx), puerto 3000
- **`supabase-db`** — PostgreSQL 15, puerto 5432
- **`supabase-auth`** — GoTrue (auth), puerto 9999
- **`supabase-rest`** — PostgREST (API REST), puerto 3001
- **`supabase-storage`** — Supabase Storage, puerto 5000
- **`supabase-functions`** — Deno Edge Functions, puerto 5001

Se usará la imagen oficial `supabase/` para cada componente.

### 3. `nginx.conf`
- SPA fallback (`try_files $uri /index.html`)
- Gzip habilitado

### 4. `.env.example`
Plantilla con todas las variables necesarias:
```
POSTGRES_PASSWORD=your-super-secret-password
JWT_SECRET=your-jwt-secret-at-least-32-chars
ANON_KEY=...
SERVICE_ROLE_KEY=...
VITE_SUPABASE_URL=http://localhost:3001
VITE_SUPABASE_PUBLISHABLE_KEY=...
SMTP_HOST=...
SMTP_PORT=...
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM_EMAIL=...
SMTP_FROM_NAME=...
```

### 5. Scripts auxiliares para importar datos

- **`scripts/export-schema.sh`** — Exporta el esquema completo (tablas, funciones, triggers, RLS policies) de la BD de producción usando `pg_dump --schema-only`
- **`scripts/export-data.sh`** — Exporta datos seleccionados con `pg_dump --data-only` (tablas configurables)
- **`scripts/import-to-local.sh`** — Aplica las migraciones de `supabase/migrations/` en orden al PostgreSQL local, luego importa datos si existen
- **`scripts/seed-from-production.sh`** — Script todo-en-uno que conecta a la BD remota (usando `SUPABASE_DB_URL` del `.env`), exporta esquema+datos, y los importa al contenedor local

### 6. `scripts/generate-keys.sh`
Genera `JWT_SECRET`, `ANON_KEY` y `SERVICE_ROLE_KEY` locales usando Node.js y `jsonwebtoken`, para no depender de claves de producción.

## Estructura de archivos

```text
/
├── Dockerfile
├── docker-compose.yml
├── nginx.conf
├── .env.example
└── scripts/
    ├── export-schema.sh
    ├── export-data.sh
    ├── import-to-local.sh
    ├── seed-from-production.sh
    └── generate-keys.sh
```

## Flujo de uso

```text
1. cp .env.example .env          # Configurar variables
2. bash scripts/generate-keys.sh # Generar JWT y API keys locales
3. docker-compose up -d          # Levantar todo
4. bash scripts/import-to-local.sh  # Aplicar migraciones
5. bash scripts/seed-from-production.sh  # (Opcional) Importar datos de producción
6. Abrir http://localhost:3000
```

## Detalle técnico

- Las 70 migraciones en `supabase/migrations/` se aplicarán secuencialmente al PostgreSQL local
- Las edge functions (15 funciones) se montarán como volumen en el contenedor de Deno
- Los buckets de storage (`school-logos`, `family-photos`, `school-assets`) se crearán automáticamente via script de inicialización
- El `docker-compose.yml` usará `env_file: .env` para todas las variables sensibles — ninguna credencial estará hardcodeada
- Los scripts de exportación/importación usan `SUPABASE_DB_URL` del `.env` para conectar a producción de forma segura

