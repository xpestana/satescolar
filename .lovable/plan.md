# Reemplazo de spinners por skeletons contextuales

## Objetivo

Sustituir los ~93 usos de `animate-spin` que actúan como **placeholders de contenido** por skeletons que reflejen la forma de la pantalla (filas de tabla, tarjetas, formularios, dashboards). Conservar los spinners que cumplen un rol distinto (botones en estado pendiente, indicadores inline). Esto da una percepción de carga más fluida y profesional sin tocar lógica de negocio.

## Principios (SOLID aplicado)

- **SRP**: cada skeleton vive como componente reutilizable con una sola responsabilidad visual.
- **OCP**: los componentes existentes consumen un nuevo `LoadingState` sin reescribir queries ni lógica.
- **DRY**: skeletons agrupados por patrón (tabla, tarjetas, dashboard, formulario) en una carpeta compartida.
- **Sin cambios en backend**: cero modificaciones a Edge Functions, RLS, hooks de datos o contratos. Solo capa de presentación → riesgo cero en VPS.

## Qué se reemplaza vs. qué se conserva

**Reemplazar por skeleton (carga de datos):**
- Tablas/listas: `SchoolsList`, `UsersList` (admin), `TeachersList`, `SubjectsList`, `AdvancedSearch`, `EnrollmentsList`, `FamiliesList`, `DelinquentStudents`, `PaymentDashboard`, `PaymentRegistration`, `StudentLedger`, `GradeSheets`, `GradesConsultation`, `AttendanceList`, `ClassroomSupervision`.
- Dashboards: `DashboardLayout` (carga inicial), `SchoolDashboard`, `TeacherDashboard`, `RepresentativeDashboard`, `ProtectedRoute`.
- Vistas de aula: `ClassroomList`, `ClassroomDetail`, `TeacherSubjects`, `TeacherGrades`, `StreamFeed`, `ClassworkList`, `PeopleList`, `TopicsManager`, `StudentProgressView`, `StudentSubmissionPanel`, `SubmissionReview`.
- Modales pesados con carga: `EvaluationPlanModal`, `TeacherReportCard`, `Preschool/PrimaryFinalReportModal`, `Preschool/PrimaryIndicatorsModal`, `FinalGradesTab`.
- Configuración: `GradesSettings`, `PaymentConfig`, `DelinquencyConfig`, `EmailComposer`, `DocumentBuilder`, `PaymentMethodsTab`.

**Conservar spinner (acción inline, no carga de contenido):**
- Botones en `isPending` / `isLoading` (guardar, enviar, eliminar).
- `S3AttachmentInput` durante upload (es feedback de progreso, no de carga de página).
- `ExchangeRateWidget` mini-indicador inline.
- `AttendanceScan` y `AttendanceScanner` (feedback de escaneo activo, no carga de datos).
- `PaymentFormModal`, `ClassroomConfigModal`, `RubricEditor`, `ActivityFormModal` cuando el spinner está en un botón submit.

## Componentes nuevos a crear

`src/components/ui/loading-skeletons.tsx` con primitivas reutilizables:

- `TableSkeleton` — props: `rows`, `columns`. Renderiza `<TableRow>` con `<Skeleton>` por celda.
- `CardGridSkeleton` — props: `count`, `columns`. Para grids de tarjetas (familias, estudiantes, materias).
- `DashboardSkeleton` — banner + grid de 4 metric cards + 2 charts.
- `FormSkeleton` — props: `fields`. Bloques label + input.
- `PageLoadingSkeleton` — fallback genérico para `DashboardLayout`/`ProtectedRoute`: barra superior + sidebar + contenido con bloques.
- `ListItemSkeleton` — fila simple (avatar + dos líneas) para feeds, comentarios, personas.
- `ChartSkeleton` — recuadro con barras grises animadas para placeholders de gráficos.

Todos basados en `<Skeleton>` ya existente (`src/components/ui/skeleton.tsx`).

## Plan de aplicación por fases

**Fase 1 — Infraestructura**
- Crear `loading-skeletons.tsx` con las primitivas listadas.

**Fase 2 — Layouts críticos**
- `DashboardLayout`, `ProtectedRoute`: spinner full-screen → `PageLoadingSkeleton` (sidebar + topbar + contenido).

**Fase 3 — Tablas y listas (mayor impacto visual)**
- Reemplazar bloques `<Loader2>` dentro de `<TableBody>` o `<div className="flex justify-center py-12">` por `<TableSkeleton>` o `<CardGridSkeleton>` según corresponda.
- Cubre admin (`SchoolsList`, `UsersList`) y school (`TeachersList`, `SubjectsList`, `FamiliesList`, `EnrollmentsList`, `AdvancedSearch`, `DelinquentStudents`, `PaymentDashboard`, etc.).

**Fase 4 — Dashboards**
- `SchoolDashboard`, `TeacherDashboard`, `RepresentativeDashboard`: las tarjetas métricas que muestran `"..."` mientras `loading` → mostrar `<Skeleton className="h-8 w-16">` dentro de `MetricCard`.

**Fase 5 — Aula virtual y módulos pesados**
- `ClassroomList`, `ClassroomDetail`, feeds y listas internas.
- Modales de grades/evaluation con carga inicial.

**Fase 6 — Configuración**
- Pantallas `GradesSettings`, `PaymentConfig`, `DelinquencyConfig`, `EmailComposer`, `DocumentBuilder` → `FormSkeleton`.

## Detalles técnicos

- No se modifican hooks (`useQuery`, `useAuth`, `useSchoolId`, etc.) ni contratos de Edge Functions.
- No se tocan archivos auto-generados (`integrations/supabase/*`).
- Cambios 100% en capa de presentación → seguro para self-hosted en VPS, sin migraciones ni env nuevos.
- Imports `Loader2` de `lucide-react` se eliminan solo cuando ya no se usan en el archivo (los botones que lo conservan lo siguen importando).
- Animación: se reutiliza `animate-pulse` del `Skeleton` existente (Tailwind nativo), sin nuevas dependencias.

## Verificación post-implementación

- Build TS pasa sin warnings de imports no usados.
- Recorrido visual de rutas clave: `/dashboard`, `/admin/users`, `/admin/schools`, `/school/teachers`, `/school/families`, `/school/payments`, `/representative/dashboard`, `/teacher/dashboard`.
- Confirmar que botones de acción (guardar, enviar correo, registrar pago) siguen mostrando spinner inline durante mutaciones.

## Fuera de alcance

- Refactor de queries / paginación.
- Cambios en Edge Functions o SMTP (no relacionado).
- Cambios de diseño más allá del estado de carga.
