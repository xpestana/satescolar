# Módulos habilitables por colegio

> 🧭 Al implementar cambios de este tema, sigue las [Convenciones de desarrollo](CONVENTIONS.md)
> (código en inglés, SOLID, pruebas, formato, una responsabilidad por archivo).

## Resumen
SAT Escolar se vende por **módulos**. El admin SAT activa o desactiva cada módulo por colegio,
con una **fecha de vencimiento opcional**. **Registro** es gratis y está siempre activo.

Si un módulo no está activo (deshabilitado o vencido):
- **Personal del colegio (`school`, owner o sub-usuario):** el ítem del menú aparece con 🔒.
  Puede entrar a la pantalla, pero la ve **desenfocada** bajo un overlay que invita a activar el
  módulo por WhatsApp (+58 412 074 3558), con un mensaje prellenado que incluye el colegio y el
  módulo.
- **Docentes y representantes:** el menú del módulo se **oculta**, y la URL directa los redirige
  a su dashboard.
- **Admin SAT:** no le afecta; siempre ve todo.

Los módulos son **independientes de los permisos** (`permission_keys`). Un owner tampoco ve un
módulo que el colegio no tiene. Los permisos siguen decidiendo *qué sub-usuario* ve cada cosa
dentro de los módulos activos.

## Catálogo

| Clave | Nombre | Incluye |
|---|---|---|
| `registration` | Registro (gratis) | Familias, estudiantes, representantes, docentes, áreas y asignación, inscripciones, búsqueda avanzada, ajustes del colegio (años, formularios, planilla de inscripción, usuarios y permisos, plantillas de correo), carnet, constructor de documentos, Datos comunes de `/planillas`. |
| `messaging` | Mensajes Masivos | `/utilidades/correo` (composer + historial); `send-email` cuando lo llama un usuario `school`. |
| `payments` | Pagos | `/pagos/*` (incluye nómina y morosidad), pestaña Facturas de `/formatos`, `/representative/pagos` y el banner de morosidad, sección "plan de pago" al inscribir, `send-delinquency-reminders`, `send-payroll-*` y sus crons. |
| `grades` | Notas, Boletas y Sábana | `/notas/consulta`, `ajustes-notas`, pestaña Boletas de `/formatos`, pestaña Sábana de `/planillas`, notas del docente y del representante, toggles de bloqueo de boleta. |
| `ministry_forms` | Planillajes del Ministerio | Pestañas Resumen Final (31059/31060, RR-DEA-06-04) y códigos/RFRE de `/planillas`. |
| `attendance` | Control de Asistencias | Escáner QR, registro y dashboard de asistencia, `/teacher/asistencias`, `record-attendance`, `/attendance/scan`. |
| `virtual_classroom` | Aula Virtual | Supervisión de aulas, aula virtual del docente y del representante, códigos de aula en el dashboard del representante. |

## Reglas de negocio
- Un módulo está activo si tiene fila con `enabled = true` y `expires_at` nulo o futuro.
  Sin fila = inactivo. `registration` siempre es activo.
- **Colegios existentes** al crear la tabla: todos los módulos habilitados, sin vencimiento.
  **Colegios nuevos:** solo Registro, hasta que el admin habilite módulos.
- `/formatos` y `/planillas` mezclan módulos, así que se bloquean **por pestaña**.
- **Pagos → Notas:** sin `payments` activo, la morosidad nunca bloquea las notas del
  representante (`representative_grades_gate`).
- **Pagos → Inscripciones:** sin `payments`, el modal de inscripción oculta la asignación de
  plan de pago.
- **Notas → Planillajes:** Resumen Final lee `final_grades`, así que `ministry_forms` sin `grades`
  genera planillas vacías. El admin ve una advertencia en ese caso.
- **Asistencias ↔ Carnet:** el carnet (con QR) es gratis; escanearlo requiere `attendance`.

## Gestión desde el admin (`/admin/colegios/:id/modulos`)
- Se llega desde **Colegios**, con el botón de módulos o haciendo clic en los iconos de la
  columna "Módulos". Esos iconos se colorean según el estado: activo, por vencer, vencido o
  inactivo.
- Cada módulo tiene:
  - un **interruptor** on/off;
  - un **"Activo hasta"** opcional (calendario), con un botón para quitar el vencimiento;
  - un badge de estado.
- Los cambios se guardan al momento.
- **Vencimiento inclusivo:** el día elegido funciona completo. Se guarda como el fin de ese día en
  hora de Venezuela (`expires_at` = día siguiente 04:00 UTC), ver `src/lib/modules/moduleExpiry.ts`.
- Si se reactiva un módulo vencido, se quita la fecha pasada.
- Botón **"Activar todos sin vencimiento"**, pensado para colegios nuevos.
- Muestra una advertencia si Planillajes del Ministerio está activo sin Notas.

## Datos / Tablas (Supabase)
- `school_modules` (`school_id`, `module_key`, `enabled`, `expires_at`, `updated_by`,
  `created_at`, `updated_at`); PK `(school_id, module_key)`. RLS: el admin gestiona y los
  usuarios del colegio (school/teacher/representative) solo leen.
- `school_has_module(_school_id, _module) → boolean` (security definer). Es el helper único para
  RLS, gates y Edge Functions.
- Migración: `20261005120000_create_school_modules.sql`.

## Estado de implementación
| Fase | Contenido | Estado |
|---|---|---|
| 0 | Documentación (este archivo) | ✅ |
| 1 | BD: `school_modules`, `school_has_module`, seed, gate de notas | ✅ desplegada 2026-10-05 |
| 2 | Núcleo frontend: catálogo, `isModuleActive`, `useSchoolModules`, `ModuleGate`, overlay WhatsApp, sidebar | ✅ (aún sin aplicar a rutas) |
| 3 | Admin: `/admin/colegios/:id/modulos` + iconos en la lista | ✅ |
| 4.1 | Gate Asistencias | ✅ (rutas, menú, `record-attendance` desplegada) |
| 4.2 | Gate Aula Virtual | ✅ (rutas, menú, botones y códigos del representante) |
| 4.3 | Gate Mensajes Masivos | ✅ (ruta, menú, `send-email` desplegada) |
| 4.4 | Gate Notas/Boletas/Sábana | ⏳ |
| 4.5 | Gate Planillajes del Ministerio | ⏳ |
| 4.6 | Gate Pagos | ⏳ |
| 5 | Endurecimiento: `school_has_module` en las políticas de escritura | ⏳ opcional |

> ⚠️ Hasta la fase 5, el bloqueo es solo de interfaz más Edge Functions. El overlay renderiza la
> página real desenfocada, así que un usuario técnico podría quitarlo con DevTools.

## Cómo bloquear una pantalla (frontend)
- **Ruta completa:** en `src/App.tsx`, envolver el elemento con
  `<ModuleRoute module="payments">` (dentro del `ProtectedRoute`). `DashboardLayout` lee el
  contexto y aplica `ModuleGate` solo al `<main>`, de modo que el sidebar y la barra superior
  quedan nítidos.
- **Pestaña o bloque dentro de una página:** envolver el contenido con
  `<ModuleGate module="grades">`.
- **Menú:** agregar `module: "payments"` al ítem de `AppSidebar.tsx`. Si el módulo está
  inactivo, el personal del colegio lo ve con 🔒 y a los demás roles se les oculta.
- En la lógica, usar `useSchoolModules().isActive(key)`. Para el admin siempre da true.

## Archivos clave (código)
- `supabase/migrations/20261005120000_create_school_modules.sql`
- `src/lib/modules/moduleCatalog.ts`: claves, nombres y textos de venta (con test).
- `src/lib/modules/moduleStatus.ts`: `isModuleActive`, `getModuleStatus`, `daysUntilExpiry` (con test).
- `src/lib/modules/salesContact.ts`: WhatsApp de ventas y mensaje prellenado (con test).
- `src/hooks/useCurrentSchoolId.ts` (colegio según el rol) y `src/hooks/useSchoolModules.ts`.
- `src/components/modules/`: `ModuleRoute`, `RouteModuleContext`, `ModuleGate` (con test),
  `LockedModuleOverlay`, `moduleIcons`.
- Admin: `src/pages/admin/SchoolModules.tsx`, `src/components/admin/SchoolModuleRow.tsx`,
  `src/components/admin/SchoolModulesIcons.tsx`, `src/hooks/useSchoolModulesAdmin.ts`,
  `src/hooks/useAllSchoolModules.ts`, `src/lib/modules/moduleExpiry.ts` (con test).
- Edge Functions: `supabase/functions/_shared/schoolModules.ts` (`isSchoolModuleActive`). Ante un
  error de BD **deja pasar**, para no bloquear a un colegio que paga; el error queda en el log.
