# SAT Escolar

Sistema de gestión escolar para colegios de Venezuela. Cubre el ciclo completo de un
colegio en una sola plataforma: familias y estudiantes, inscripciones, docentes y
asignaciones académicas, notas y boletas, asistencias por QR, aula virtual, cobranza
y nómina.

La aplicación es multi-colegio (multi-tenant): cada colegio opera sobre sus propios
datos, con años escolares, formularios, formatos de impresión y perfiles de permisos
independientes.

## Estado

En producción. El frontend se despliega en Cloudflare Pages con cada push a `main`;
la base de datos y la lógica privilegiada corren sobre Supabase. También existe un
stack completo autoalojado con Docker Compose para desarrollo y respaldos.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18, TypeScript, Vite (SWC), React Router 6 |
| UI | Tailwind CSS, shadcn/ui (Radix), lucide-react |
| Datos | TanStack Query, Supabase JS |
| Backend | Supabase (PostgreSQL + RLS, Auth, Storage) y Edge Functions en Deno |
| Documentos | jsPDF, docx, xlsx-js-style, html2canvas, qrcode |
| Pruebas | Vitest, Testing Library |
| Infra | Docker + Nginx, GitHub Actions, Cloudflare Pages, AWS S3 |

## Roles

| Rol | Alcance |
|---|---|
| `admin` | Administración de la plataforma: alta de colegios, usuarios globales, importaciones. |
| `school` | Personal del colegio. Puede ser propietario (acceso total) o sub-usuario con perfiles de permisos granulares. |
| `teacher` | Docente: sus materias asignadas, carga de notas, asistencias y aula virtual. |
| `representative` | Representante: su familia, sus estudiantes, estado de cuenta y pagos. |

## Módulos

- **Registros** — familias, representantes, estudiantes y docentes, con campos
  dinámicos definidos por el propio colegio.
- **Académico** — áreas y materias, asignación *docente × área × sección × año*,
  planes de evaluación, notas, boletas y resúmenes finales (incluye formatos
  oficiales en Word).
- **Inscripciones y planillas** — proceso de inscripción con validación de
  completitud y planillas configurables.
- **Asistencias** — registro por escaneo de QR, listados y dashboard.
- **Aula virtual** — publicación de contenido por asignación y supervisión desde el
  colegio.
- **Cobranza** — configuración de conceptos y planes, registro de pagos, estado de
  cuenta por estudiante, morosidad, créditos de familia y reporte de ingresos.
  Los montos se liquidan en VES usando la tasa BCV del día.
- **Nómina** — beneficiarios, cálculo de conceptos, recibos y reporte mensual.
- **Correos** — plantillas editables por colegio y envío desde la plataforma.
- **Importación** — carga masiva de datos de colegio y de calificaciones.

## Requisitos

- Node.js 20 o superior (o Bun 1.x, que es lo que usan el Dockerfile y el pipeline)
- Docker y Docker Compose, solo si vas a levantar el stack local de Supabase

## Puesta en marcha

```bash
git clone git@github.com:xpestana/satescolar.git
cd satescolar
npm install
cp .env.example .env
npm run dev
```

La aplicación queda en `http://localhost:8080`.

Para apuntar a Supabase basta con tres variables en `.env`:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_PROJECT_ID=
```

El resto de variables de `.env.example` (PostgreSQL, JWT, SMTP, S3, Firecrawl) solo
hacen falta para el stack autoalojado.

## Stack local completo

`docker-compose.yml` levanta PostgreSQL, PostgREST, Auth, Storage, Edge Functions,
el gateway, Studio y el frontend compilado. Las migraciones se aplican solas al
arrancar mediante un runner que lleva registro en `public._docker_migrations`.

```bash
node scripts/generate-keys.js   # genera JWT_SECRET, ANON_KEY y SERVICE_ROLE_KEY
docker compose up -d --build
```

- Aplicación: `http://localhost:3000`
- API gateway: `http://localhost:8000`
- Supabase Studio: `http://localhost:54321` (protegido con Basic Auth)

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo con HMR |
| `npm run build` | Compilación de producción |
| `npm run preview` | Sirve el build local |
| `npm run lint` | ESLint sobre todo el repositorio |
| `npm test` | Pruebas con Vitest |
| `npm run test:watch` | Pruebas en modo watch |

En `scripts/` hay utilidades operativas: exportación de esquema y datos, importación
al entorno local, siembra desde producción, migraciones y configuración de CORS en S3.

## Estructura

```
src/
  pages/         Vistas enrutadas, agrupadas por rol (admin, school, teacher, representative)
  components/    Componentes de UI por dominio
  hooks/         Estado y acceso a datos (React Query, sesión, permisos)
  lib/           Lógica pura y generación de documentos (sin React, con pruebas)
  integrations/  Cliente y tipos generados de Supabase
supabase/
  functions/     Edge Functions en Deno (operaciones privilegiadas)
  migrations/    Esquema versionado
docs/desc/       Documentación funcional por tema
scripts/         Utilidades de operación y datos
docker/          Configuración del stack autoalojado
```

## Documentación

`docs/desc/` contiene un archivo por dominio funcional con casos de uso, rutas,
permisos, tablas y reglas de negocio. Es el punto de partida antes de tocar código.

Antes de implementar cualquier cosa, lee
[`docs/desc/CONVENTIONS.md`](docs/desc/CONVENTIONS.md). En resumen: identificadores en
inglés e interfaz en español, una responsabilidad por archivo, tipado estricto sin
`any`, lógica de negocio en `src/lib/**` siempre con pruebas, consultas acotadas por
`school_id` confiando en RLS, y toda operación privilegiada en una Edge Function —
la `service_role` nunca viaja al cliente.

## Despliegue

- **Frontend**: `.github/workflows/deploy.yml` compila con Bun y publica en
  Cloudflare Pages en cada push a `main`.
- **Respaldos**: `.github/workflows/backup.yml` vuelca a diario el esquema `public` y
  los usuarios de `auth` de la base de producción.
- **Autoalojado**: `Dockerfile` genera la imagen del frontend (build con Bun, servido
  por Nginx) que usa `docker-compose.yml`.

## Licencia

Proyecto privado. Todos los derechos reservados.
