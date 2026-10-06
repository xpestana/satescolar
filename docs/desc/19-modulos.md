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
| `registration` | Registro (gratis) | Familias, estudiantes, representantes, inscripciones, búsqueda avanzada, ajustes del colegio (años, formularios, planilla de inscripción, usuarios y permisos, plantillas de correo), carnet, constructor de documentos, Datos comunes de `/planillas`. |
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
- **Docentes y Áreas → Notas, Aula Virtual o Asistencias:** Docentes, Áreas y Asignación de
  Áreas solo sirven si el colegio puede usar a sus docentes, así que se habilitan con **cualquiera**
  de `grades`, `virtual_classroom` o `attendance` (`TEACHING_MODULES` en
  `src/lib/modules/moduleRequirement.ts`). Si no tiene ninguno, se ven con el overlay de Notas, que
  menciona las alternativas. Sin ellos, el dashboard del colegio muestra las métricas de docentes
  y áreas y el gráfico de carga docente con **datos de ejemplo** y un enlace corto a WhatsApp
  (`ModuleDemoNotice`), y omite los avisos de docentes sin áreas.
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
| 4.4 | Gate Notas/Boletas/Sábana | ✅ (rutas, menú, pestañas Sábana y Boletas, docente, representante, toggles de bloqueo) |
| 4.5 | Gate Planillajes del Ministerio | ✅ (pestaña Resumen Final de `/planillas`; Constructor y Configuraciones › Datos comunes siguen gratis) |
| 4.6 | Gate Pagos | ✅ (rutas `/pagos/*` y `/representative/pagos`, menú, pestaña Facturas, banner de morosidad, plan de pago al inscribir, funciones `send-delinquency-reminders` y `send-payroll-*` desplegadas 2026-10-05) |
| 5 | Endurecimiento: `school_has_module` en las políticas de escritura | ✅ desplegada 2026-10-06 (59 tablas) |

## Bloqueo en la base de datos (fase 5)
- Migración `20261006120000_school_modules_write_policies.sql`: cada tabla de un módulo vendible
  tiene dos políticas **RESTRICTIVE** para `authenticated`, `module_gate_insert` y
  `module_gate_update`, con la condición `is_admin() OR school_has_module(school_id, <módulo>)`.
  Se suman (AND) a las políticas existentes sin reescribirlas.
- **No** se restringen lecturas (el overlay muestra la página real desenfocada y el colegio sigue
  viendo su historial al vencer un módulo) ni borrados (no dan valor y algunos flujos de Registro
  limpian filas relacionadas).
- No les afectan: el admin, `service_role` (Edge Functions y crons) ni las funciones/triggers
  `SECURITY DEFINER` (por ejemplo, los que crean códigos de aula y tokens de asistencia al
  registrar personas). Las RPC `SECURITY DEFINER` que escriben tampoco pasan por estas políticas.
- Docentes/Áreas (`TEACHING_MODULES`) siguen bloqueados solo en la interfaz: esas tablas las
  escriben flujos de Registro.
- Efecto: si un usuario quita el overlay con DevTools, un INSERT falla con *new row violates
  row-level security policy "module_gate_insert"* y un UPDATE no afecta filas.
- Para agregar una tabla nueva de un módulo, sumarla a la lista de la migración (o a una nueva
  con el mismo patrón).

## Cómo bloquear una pantalla (frontend)
- **Ruta completa:** en `src/App.tsx`, envolver el elemento con
  `<ModuleRoute module="payments">` (dentro del `ProtectedRoute`). `DashboardLayout` lee el
  contexto y aplica `ModuleGate` solo al `<main>`, de modo que el sidebar y la barra superior
  quedan nítidos.
- **Pestaña o bloque dentro de una página:** envolver el contenido con
  `<ModuleGate module="grades">` y poner `<ModuleLockIcon module="grades" />` en su
  `TabsTrigger` (ejemplo: Sábana en `GradeSheets.tsx`, Boletas en `FormatsConfig.tsx`).
- **Botón o acción suelta:** ocultarla con `isActive(key)`. Por ejemplo, el docente sin `grades`
  ve sus áreas sin plan ni "Registrar Notas", y `StudentGradeAccessToggle` no se renderiza.
- **Menú:** agregar `module: "payments"` al ítem de `AppSidebar.tsx`. Si el módulo está
  inactivo, el personal del colegio lo ve con 🔒 y a los demás roles se les oculta.
- **Bloque de dashboard en demo:** en lugar de ocultarlo, mostrar datos de ejemplo y
  `<ModuleDemoNotice module="grades" />` (etiqueta "Ejemplo" + enlace de texto a WhatsApp, sin
  botón). No consultar los datos reales mientras está en demo.
- **Varios módulos ("cualquiera de"):** `module` acepta una lista, por ejemplo
  `<ModuleRoute module={TEACHING_MODULES}>` o `module: TEACHING_MODULES` en el menú. El overlay
  vende el primero de la lista y nombra los demás.
- En la lógica, usar `useSchoolModules().isActive(key)` o
  `isRequirementMet(lista, isActive)`. Para el admin siempre da true.

## Archivos clave (código)
- `supabase/migrations/20261005120000_create_school_modules.sql`
- `src/lib/modules/moduleCatalog.ts`: claves, nombres y textos de venta (con test).
- `src/lib/modules/moduleStatus.ts`: `isModuleActive`, `getModuleStatus`, `daysUntilExpiry` (con test).
- `src/lib/modules/moduleRequirement.ts`: requisitos "cualquiera de" y `TEACHING_MODULES` (con test).
- `src/lib/modules/salesContact.ts`: WhatsApp de ventas y mensaje prellenado (con test).
- `src/hooks/useCurrentSchoolId.ts` (colegio según el rol) y `src/hooks/useSchoolModules.ts`.
- `src/components/modules/`: `ModuleRoute`, `RouteModuleContext`, `ModuleGate` (con test),
  `LockedModuleOverlay`, `ModuleLockIcon`, `ModuleDemoNotice`, `moduleIcons`.
- Admin: `src/pages/admin/SchoolModules.tsx`, `src/components/admin/SchoolModuleRow.tsx`,
  `src/components/admin/SchoolModulesIcons.tsx`, `src/hooks/useSchoolModulesAdmin.ts`,
  `src/hooks/useAllSchoolModules.ts`, `src/lib/modules/moduleExpiry.ts` (con test).
- Edge Functions: `supabase/functions/_shared/schoolModules.ts` (`isSchoolModuleActive`). Ante un
  error de BD **deja pasar**, para no bloquear a un colegio que paga; el error queda en el log.
