# Pagos y administrativo

> 🧭 Al implementar cambios de este tema, sigue las [Convenciones de desarrollo](CONVENTIONS.md)
> (código en inglés, SOLID, pruebas, formato, una responsabilidad por archivo).

## Resumen
Módulo administrativo/financiero: registro de pagos, estados de cuenta, morosidad,
ingresos y configuración de métodos/formatos de pago. El representante consulta y paga.

## Roles involucrados
- **school** — todo el ciclo administrativo (permisos `payments.*`).
- **representative** — ve y realiza sus pagos.

## Casos de uso
- El colegio registra un pago y se actualiza el estado de cuenta de la familia.
- El colegio **elige/diseña el formato de la factura** en `/formatos` → pestaña
  **"Formato de Facturas"**, que se aplica al emitir/imprimir comprobantes.
- Se identifican morosos y se envían recordatorios automáticos.
- El sistema obtiene la tasa BCV para conversión de montos.
- El representante consulta su estado de cuenta y realiza pagos.

## Formato de la factura (`/formatos`)
El **formato de la factura/comprobante se elige/configura en `/formatos`** (pestaña
"Formato de Facturas"). Es el mismo patrón que la **boleta** en notas (ver
[09-notas-y-boletas](09-notas-y-boletas.md)): la config guardada allí es la fuente de verdad
y **debe respetarse al generar/imprimir la factura**.

- Se guarda en `invoice_templates` (`school_id`, `config`, `is_active`, …).
- **Activación:** al activar una plantilla se **desactivan las demás del colegio**
  (una sola factura activa por colegio) — a diferencia de las boletas, que pueden tener
  varias activas segmentadas por grado.

> ⚠️ Regla clave: cualquier cambio en la generación/impresión de la factura debe leer y
> respetar la configuración de `/formatos` (tabla `invoice_templates`), no valores fijos.

## Operaciones / Funciones
| Operación | Rol | Ruta | Permiso | Descripción |
|---|---|---|---|---|
| Dashboard pagos | school | `/pagos` | `payments.view` | Panel general de pagos. |
| Registro de pagos | school | `/pagos/registro` | `payments.register` | Registrar un pago. |
| Estado de cuenta | school | `/pagos/estado-cuenta` | `payments.view` | Estado de cuenta por familia/estudiante. |
| Morosos | school | `/pagos/morosos` | `payments.delinquency` | Listado de morosos. |
| Ingresos | school | `/pagos/ingresos` | `payments.view` | Reporte de ingresos. |
| Config. pagos | school | `/pagos/configuracion` | `payments.config` | Conceptos, planes, métodos y ajustes (4 pestañas). |
| Formato de Facturas | school | `/formatos` (pestaña Facturas) | `payments.config` | Diseño/elección del formato de factura/comprobante. |
| Config. morosidad | school | `/pagos/morosidad` | `payments.delinquency` | Reglas/avisos de morosidad. |
| Mis pagos | representative | `/representative/pagos` | — | Pagos de la familia. |

## Rutas (frontend)
- `/pagos`, `/pagos/registro`, `/pagos/estado-cuenta`, `/pagos/morosos`, `/pagos/ingresos`
- `/pagos/configuracion`, `/formatos`, `/pagos/morosidad`
- `/representative/pagos`

## Endpoints / Edge Functions
- `send-delinquency-reminders` — recordatorios de morosidad. **Desplegado y activo.** Se dispara
  por cron diario (`cron.schedule('delinquency-reminders', '0 12 * * *', …)` — 12:00 UTC / 08:00
  VE, después del `delinquency-rebuild` de las 07:00; migración
  `20260713120000_delinquency_reminders_cron.sql`, patrón del cron de nómina, secretos en Vault
  `project_url`/`service_role_key`). La función filtra por colegio según
  `delinquency_config.reminder_mode` (never/daily/weekly/monthly_days) y deduplica por día vía
  `delinquency_notifications`.
  > 🐞 "No se enviaban recordatorios" tenía **dos** causas, ambas corregidas y desplegadas:
  > 1. **No había cron** que ejecutara la función (solo estaba el de nómina). Se agregó
  >    `delinquency-reminders`. *(El cron `delinquency-rebuild` que ya existía solo reconstruye
  >    saldos, no envía.)*
  > 2. **Faltaba la FK** `delinquency_config.school_id → schools`, así que el embed
  >    `schools(...)` de la función fallaba con 500 ("Could not find a relationship…"). Se agregó
  >    la FK + índice único por colegio (migración `20260713110000_delinquency_config_school_fk.sql`)
  >    y se recargó el schema cache de PostgREST.
  > Verificado end-to-end: la función responde `{success:true, sent:0, errors:0}` en un día que no
  > coincide con ninguna config (no envía correos de más).
- `fetch-bcv-rates` — tasa de cambio BCV para conversión de montos.

## Configuración de Pagos (`/pagos/configuracion`)
Pantalla `PaymentConfig` ("Configuración de Pagos") con **4 pestañas**:
- **Conceptos** (`payment_concepts`) — conceptos de cobro (matrícula, mensualidad, etc.).
- **Planes** (`payment_plans` + `payment_plan_concepts`) — planes que agrupan conceptos.
- **Métodos de Pago** — métodos disponibles (ver `PaymentMethodsTab`).
- **Configuraciones** — ajustes generales de facturación (ligado a `useBillingMode`).

## Morosidad (`/pagos/morosos` + `/pagos/morosidad`)
- **Cálculo de morosos:** RPCs autoritativos (mismo criterio en UI y en la edge function):
  `get_delinquent_students` (por estudiante) y `get_delinquent_families` (agrupado por familia,
  lo usa `DelinquentFamiliesView`). Se basan en `student_concept_balances` y el `overdue_after_day`
  del colegio. Antes de calcular se suele llamar `rebuild_student_concept_balances_for_active_year()`.
- **Configuración** (`DelinquencyConfig`, `/pagos/morosidad`): guarda en `delinquency_config`
  el día de corte y la frecuencia de recordatorios (`reminder_mode` + días).
- **Pipeline de recordatorios:** cron diario `delinquency-reminders` (12:00 UTC) → invoca
  `send-delinquency-reminders` → por cada colegio evalúa `reminder_mode` vs. hoy → arma la deuda
  desde el RPC → envía por `send-email` (o SMTP si hay plantilla propia `email_templates`
  `template_type='delinquency'`) → registra en `delinquency_notifications` (dedupe por día).
  Ver detalle y correcciones en **Endpoints / Edge Functions**.
- **Cron `delinquency-rebuild` (`0 7 * * *`):** solo ejecuta
  `rebuild_student_concept_balances_for_active_year()` (reconstruye saldos), **no envía correos**;
  no confundir con `delinquency-reminders`.

> 📌 **Estado operativo (jul 2026):** los **4 colegios** están en `reminder_mode = 'never'` a
> pedido — no se envía ningún recordatorio por ahora. Los 2 que no tenían fila tienen `never`
> explícito. El cron `delinquency-reminders` queda agendado pero inofensivo (envía 0 mientras
> todos estén en `never`); para reactivar, cambiar la frecuencia del colegio en `/pagos/morosidad`.

## Datos / Tablas (Supabase)
- `invoice_templates` — plantillas de formato de factura: `school_id`, `config` (JSON),
  `is_active` (una sola activa por colegio).
**Configuración (catálogo):**
- `payment_concepts` — conceptos de cobro: `concept_type`, `currency`, `default_amount`, `is_active`.
- `payment_plans` — planes; `payment_plan_concepts` — conceptos del plan con
  `amount`, `discount_type`/`discount_value`, `due_day`/`due_month`, `is_recurring`, `is_mandatory`.
  El **descuento** puede ser `percentage` (0–100) o `fixed` (monto absoluto en la moneda del
  concepto); el neto es `calcFinalAmount()` en `PaymentConfig.tsx`
  (`amount·(1−%/100)` o `amount−fijo`, con piso en 0).
- `school_payment_methods` — métodos de pago configurados: `method_type`, `label`,
  `config` (JSON), `is_active`.
- `delinquency_config` — reglas de morosidad **(una fila por colegio)**: `school_id`
  (**FK → `schools`**, con índice único por colegio — ambos agregados en
  `20260713110000_delinquency_config_school_fk.sql`), `overdue_after_day` (día de corte),
  `reminder_mode` (`never`/`daily`/`weekly`/`monthly_days`), `reminder_days_of_week` (jsonb,
  p.ej. `["lunes","jueves"]`), `reminder_days_of_month` (jsonb, p.ej. `[1,15]`).
- `delinquency_notifications` — **bitácora de recordatorios enviados**: `school_id`,
  `student_id`, `family_id`, `email_sent_to`, `total_owed_ves`, `concepts_detail`, `status`
  (`sent`/`failed`), `error_message`, `sent_at`. Sirve de **dedupe por día** (no reenviar al
  mismo estudiante el mismo día) y de auditoría de envíos/fallos.

**Asignación y saldos (estado de cuenta):**
- `student_payment_plans` — plan asignado a un estudiante por año escolar.
- `student_concept_balances` — **el ledger**: saldo por estudiante × `plan_concept` × año:
  `total_amount`, `paid_amount`, `balance`, `status`, `currency`,
  `exchange_rate_snapshot`, `last_payment_date`. Fuente del estado de cuenta y morosidad.
- `family_credits` — **ledger de "saldo a favor" por familia** (append-only): filas `entry_type`
  `credit` (genera saldo) o `debit` (lo consume), `amount_ves`, `source_payment_id` (factura que
  generó el crédito), `applied_payment_id` (factura donde se aplicó), `note`. El saldo disponible
  es `SUM(credit) - SUM(debit)` (RPC `get_family_credit_balance(_family_id)`). Se usa cuando un
  pago deja un sobrante que el representante quiere abonar a una cuota futura, en vez de
  registrarlo como ingreso realizado en "Otros".
  > 🐞 Bug corregido (migración `20260714130000_create_family_credits.sql`): antes, un sobrante
  > sin marcar "Agregar a Otros" solo quedaba como texto libre en `payments.observations` — no
  > existía ninguna tabla que lo registrara, así que no aparecía en el historial, el dashboard ni
  > el estado de cuenta (caso real: factura 016836, 20,43 VES de sobrante documentados solo en la
  > nota). La migración crea `family_credits` y hace un backfill retroactivo de ese caso.

**Pagos / factura:**
- `payments` — comprobante/factura emitida: `control_number`, `invoice_number`,
  `invoice_name`/`invoice_rif`/`invoice_address`/`invoice_phone`, `total_amount_ves`,
  `status`, anulación (`voided_at`/`voided_by`/`void_reason`), `student_id`, `school_year_id`.
- `payment_items` — líneas del pago por concepto del plan: `plan_concept_id`, `student_id`
  (**clave para resolver el/los estudiante(s) en modo familia**, donde `payments.student_id`
  es null), `amount_ves`, `is_partial`. El **tipo** del concepto se obtiene vía
  `payment_plan_concepts → payment_concepts.concept_type` (`mensualidad`, `inscripcion`,
  `seguro_escolar`, …).
- `payment_others` — líneas de ingresos que **no** cuelgan de un concepto del plan (categoría
  **"Otros"** en Ingresos): `payment_id`, `amount_ves`.
- `payment_method_entries` — pago **multi-método**: por entrada `method`, `currency`,
  `amount_original`, `amount_ves`, `exchange_rate`, `bank_name`, `reference_code`.
- `payment_reports` — pagos **reportados por la familia** pendientes de confirmar
  (`confirmed_at`/`confirmed_payment_id`).
- `payment_edit_log` — **auditoría de ediciones de pagos**: `payment_id`, `school_id`,
  `edited_by`, `reason` (motivo, obligatorio en la UI), `before_snapshot`/`after_snapshot` (jsonb
  con el pago + items + métodos + créditos antes/después de editar). Una fila por cada vez que se
  usa **"Editar pago"** en el historial familiar.

**Tasas de cambio:** `bcv_rates`, `exchange_rates` (alimentan la conversión a VES).

## Tasas de cambio (`ExchangeRateWidget`)
Widget flotante (`src/components/payments/ExchangeRateWidget.tsx`) presente en Registro de
Pagos y Registro de Nómina. Muestra USD/EUR/COP en VES.

**Dos capas de tasa:**
- **Oficial (BCV):** `bcv_rates` (global por `published_date`) → se propaga a `exchange_rates`
  (por `school_id`) vía la edge function `fetch-bcv-rates`. **Es la fuente para conversiones.**
- **Override personal (temporal):** cuando un usuario **edita** una tasa en el widget, NO se
  escribe en la DB (eso la cambiaría para todos los colegios y además la sobrescribe el
  auto-refresco BCV). Se guarda en **`localStorage`** por `school_id`+`currency` con **TTL de
  3 horas** (`src/lib/exchangeRateOverride.ts`); al expirar se elimina y vuelve la tasa BCV.
  Es **solo para ese usuario/navegador**.

**Auto-refresco:** al montar, el widget llama `ensureFreshBcvRates()` (solo trae de BCV si la
fecha en DB no es la de hoy en Caracas). El botón **"Actualizar hoy"** fuerza la descarga
llamando directo a `fetch-bcv-rates` aunque ya sea la fecha de hoy.
> Antes el widget del **colegio** nunca refrescaba (solo lo hacían flujos del representante en
> `RepPayments`/`PaymentReportModal`), por eso la tasa se quedaba con la fecha vieja.

**El override alcanza las conversiones del mismo usuario:** `PaymentFormModal`,
`FamilyPaymentFormModal` (`getRate`) y `usePayrollUsdRate` aplican `applyRateOverride(...)`
encima de la tasa de `exchange_rates`. `PaymentReportModal` (representante) NO lo usa: las
familias siempre convierten con la tasa oficial.

## Dashboard de Pagos (`/pagos`) — "Últimos Pagos"
Tabla `PaymentDashboard.tsx` con los últimos pagos `completed`. La columna
**Estudiante / Familia** se resuelve así (un pago puede no traer `student_id`):
- **Estudiante(s):** en **modo estudiante** el pago trae `student_id` → `students.form_data`.
  En **modo familia** el pago trae `student_id = null` y `family_id` set; los estudiantes se
  obtienen de **`payment_items.student_id`** (embebido `payment_items(student_id, students(form_data))`),
  admitiendo varios hijos por pago.
- **Titular/Familia:** `Flia. [father_last_name] [mother_last_name]`; si la familia no tiene
  apellidos, se usa **`payments.invoice_name`** (titular de la factura, siempre capturado al
  registrar). El nombre del estudiante va arriba y el titular/familia debajo.
> 🐞 Bug corregido: antes solo se leía `students`/`families`; en modo familia (sin `student_id`
> y con apellidos vacíos) la columna quedaba en "—". Ahora resuelve por `payment_items` y cae
> a `invoice_name`.

### Nombre de familia en las listas (`familyDisplayName.ts`)
La columna **Familia** muestra `father_last_name`+`mother_last_name`; como suelen venir vacíos,
si no hay apellidos propios se toman los del **representante principal**
(`representatives.is_primary`, fallback: primer representante) desde su `form_data`
(`primer_apellido`/`segundo_apellido`). **No** se usan los apellidos del estudiante. El sort y la
búsqueda usan el mismo apellido de respaldo. Helper compartido en `src/lib/familyDisplayName.ts`
(`familySurname` + `buildPrimaryRepMap`), usado por **Registro de Pagos**
(`FamilyPaymentRegistrationTab`), **Estado de cuenta por familia** (`FamilyLedgerView`) y
**Morosos por familia** (`DelinquentFamiliesView`).
> 🐞 Antes las tres listas mostraban "Sin apellidos" para casi todas las familias aunque
> hubiera representante.

En **Morosos por familia** (`DelinquentFamiliesView`) la columna **"Estudiantes con Deuda"**
lista los **nombres** de los estudiantes morosos (no solo el contador). Los nombres se resuelven
con una consulta directa a `students` (`studentInfoMap`), para cubrir también a los morosos **no
inscritos** en el año activo (que no aparecen en `enrollments`).

## Reporte de Ingresos (`/pagos/ingresos`)
Pantalla `IncomesReport` con la tabla **"Detalle de Pagos"** (pagos con `status <> 'voided'` del
año/mes; `N°` de operación **estable por mes**, asignado por `created_at` ASC antes de filtrar) y
tarjetas de totales (Total Ingresos / Mensualidad / Inscripción / Seguro Escolar / Otros).

**Columnas por tipo de concepto:** cada pago se descompone sumando sus `payment_items` por
`payment_plan_concepts → payment_concepts.concept_type`:
- **Mensualidad** = items con `concept_type = 'mensualidad'`.
- **Inscripción** = `'inscripcion'`.
- **Seguro Escolar** = `'seguro_escolar'`.
- **Otros** = suma de `payment_others.amount_ves` (no cuelgan de un concepto del plan).
- **Total Ingresos** = `payments.total_amount_ves` (no la suma de columnas: puede haber conceptos
  fuera de esas 4 categorías). Nombre/RIF salen de `invoice_name`/`invoice_rif`.

**Exportar a Excel** (botón "Descargar Excel", helper `src/lib/incomesExcel.ts`):
- Usa **`xlsx-js-style`** (fork de SheetJS con estilos; el `xlsx` community no colorea celdas).
- Encabezado y filas del detalle, y **una fila TOTALES** con el total impreso bajo cada columna
  numérica, coloreada.
- Debajo, un **resumen vertical centrado** (título + los 5 totales, uno debajo del otro),
  también coloreado. Montos como número real con formato `#,##0.00`.
- Respeta los filtros/mes activos (exporta `filtered`, no el crudo). Fechas con `formatDateOnly`.

## Reglas de negocio
- **Fechas calendario (`payment_date`, etc.):** mostrar SIEMPRE con `formatDateOnly()` de
  `src/lib/dateUtils.ts` (extrae `YYYY-MM-DD` sin conversión de zona). **Nunca**
  `new Date(fecha).toLocaleDateString(...)` sobre una fecha "solo fecha": `new Date("2026-07-03")`
  se interpreta como UTC y en Venezuela (UTC-4) retrocede al día 2.
  > 🐞 Corregido en el historial familiar (`FamilyPaymentHistoryModal`) y en el estado de cuenta
  > por familia + su PDF (`FamilyLedgerView`), que mostraban un día antes. El dashboard y
  > `PaymentHistoryModal` ya usaban `formatDateOnly`.
- **El formato de factura se define en `/formatos` (tabla `invoice_templates`) y la
  emisión/impresión debe respetarlo** — mismo patrón que la boleta en notas.
- Solo una plantilla de factura activa por colegio.
- **Estado de cuenta / morosidad** se calculan sobre `student_concept_balances`
  (`total_amount` − `paid_amount` = `balance`), no sobre `payments` directamente.
- Al asignar un plan (`student_payment_plans`) se generan los balances por concepto
  (ver funciones `create_missing_student_concept_balances_*`,
  `rebuild_student_concept_balances_for_active_year`).
- **Descuento del plan aplicado al ledger:** el `discount_type`/`discount_value` del
  `payment_plan_concepts` se descuenta al **sembrar** el balance, no en la UI. Las funciones
  generadoras usan el helper SQL `discounted_plan_concept_amount(amount, type, value)` para
  fijar `original_amount` (neto, en moneda del concepto) y `total_amount = neto · tasa`. Así el
  descuento se refleja por igual en el **modal de registro** (`PaymentFormModal`, que solo
  muestra el ledger), en el **estado de cuenta** y en **morosidad/ingresos**.
  > 🐞 Bug corregido (migración `20260714120000_apply_plan_concept_discount_to_balances.sql`):
  > las funciones de saldo eran anteriores a la columna de descuento (`20260610160000`), así que
  > sembraban el **monto bruto** y la cuota salía sin descuento en el registro. La migración
  > reescribe las 3 funciones generadoras, agrega `sync_unpaid_balances_for_plan_concept` +
  > trigger para resincronizar cuotas **no pagadas** cuando se edita `amount`/descuento, y hace
  > **backfill** de los balances no pagados ya creados. Solo toca cuotas con `paid_amount = 0`
  > para no alterar pagos ya registrados.
- Montos se manejan en **VES** con `exchange_rate` por entrada; la conversión usa
  `bcv_rates`/`exchange_rates` (función `fetch-bcv-rates`).
- Un pago puede **anularse** (`voided_*`) y admite **múltiples métodos** por comprobante.
- Las familias pueden **reportar** pagos (`payment_reports`) que el colegio confirma,
  generando el `payments` definitivo.
- **Saldo a favor (`family_credits`):** cuando un pago deja un sobrante (`Total Pagado` >
  `Total Conceptos`), el colegio elige en el modal de registro entre **"+ Agregar a Otros"**
  (ingreso realizado, va a `payment_others`) o **"+ Guardar como saldo a favor"** (crédito para
  la familia, va a `family_credits` con `entry_type = 'credit'`). El saldo a favor se **consume**
  en un pago futuro seleccionándolo como una forma de pago más ("Saldo a favor (crédito)"), que
  inserta una fila `entry_type = 'debit'`; el monto se descuenta en VES contra el `balance` de la
  cuota igual que cualquier otro método, por lo que si la cuota es en USD, el descuento efectivo
  en dólares depende de la **tasa BCV vigente el día en que se aplica** (mismo mecanismo de
  `getDisplayTotal`/`exchange_rates` que ya usan las demás formas de pago). Visible en el
  **historial de pagos por familia** (`FamilyPaymentHistoryModal`, sección "Movimientos de saldo
  a favor"), en el **dashboard** (card "Créditos disponibles" + indicador por fila en "Últimos
  Pagos") y en el **estado de cuenta** (`FamilyLedgerView` para el colegio, alerta en
  `RepPayments` para el representante).
- **Editar pago (`EditPaymentModal`):** desde el **historial de pagos por familia**
  (`FamilyPaymentHistoryModal`, ícono lápiz junto a Eliminar) se puede corregir un pago ya
  registrado — conceptos/montos, formas de pago, N° de factura/control, datos de facturación y
  observaciones — para casos de error (p. ej. un descuento aplicado mal, un sobrante mal
  clasificado). Requiere un **motivo obligatorio**. Al guardar: revierte el efecto del pago viejo
  sobre `student_concept_balances` y sobre los `family_credits`/`payment_others` que hubiera
  generado, reemplaza `payment_items`/`payment_method_entries`, reaplica los saldos con los
  valores nuevos y **actualiza el mismo registro de `payments`** (no crea uno nuevo, conserva
  N° de factura/control salvo que se cambien a propósito). Cada edición queda en
  `payment_edit_log` con snapshot antes/después y el motivo, para auditoría.

## Archivos clave (código)
- `src/pages/school/FormatsConfig.tsx` (contenedor de pestañas Facturas/Boletas)
- `src/components/payments/InvoiceFormatTab.tsx` (editor de formato de factura)
- `src/lib/buildInvoiceData.ts`, `src/hooks/useBillingMode.ts`
- `src/components/payments/PaymentMethodsTab.tsx`, `src/components/payments/...`
- `src/hooks/payments/useFamilyCredits.ts` (balance + movimientos de saldo a favor por familia),
  `src/lib/familyCredit.ts` (constante del método `saldo_a_favor`)
- `src/components/payments/EditPaymentModal.tsx` (edición de un pago ya registrado: revierte y
  reaplica saldos/crédito, exige motivo, audita en `payment_edit_log`)

## Nómina (Pagos de Nóminas)
Submódulo dentro del área de Pagos para registrar, aprobar y controlar los pagos al
**personal del colegio** (docentes, administrativos, obreros y "otros": proveedores,
suplentes, honorarios). Reutiliza el patrón UX del selector de cuotas y el sistema de
permisos existente; **no** cuelga de `student_id` (tiene su propio esquema `payroll_*`).

### Permisos (module "Pagos", tabla `permission_keys`)
| Permiso | Para qué |
|---|---|
| `payroll.view` | Ver dashboard, beneficiarios y consultas de nómina + export Excel. |
| `payroll.register` | Elaborar pagos, beneficiarios y métodos (quien **elabora**). |
| `payroll.approve` | Aprobar / marcar pagado / anular (quien **aprueba** → segregación de funciones). |
| `payroll.config` | Configurar conceptos y períodos de nómina. |

El gating es el mismo del resto: `permission` en `AppSidebar.tsx`, `ProtectedRoute` (rol
`school`) y `usePermissions().has()`. RLS acota por `school_id` (patrón del módulo de pagos).

### Operaciones / Rutas (frontend)
| Operación | Ruta | Permiso |
|---|---|---|
| Dashboard de Nómina (indicadores + export Excel) | `/pagos/nomina` | `payroll.view` |
| Registro de Nómina (selector por período: registrar→aprobar→pagar→anular) | `/pagos/nomina/registro` | `payroll.register` / `payroll.approve` |
| Beneficiarios (alta, métodos de pago, ficha/historial + recibo PDF) | `/pagos/nomina/beneficiarios` | `payroll.view` / `payroll.register` |
| Configuración de Nómina (conceptos + períodos) | `/pagos/nomina/configuracion` | `payroll.config` |

### Datos / Tablas (Supabase, todas con RLS por `school_id`)
- `payroll_beneficiaries` — beneficiario: `category` (`teacher`/`admin`/`worker`/`other`),
  `teacher_id` (FK a **`teachers`** cuando es docente, para no duplicar), `full_name`,
  `document_id`, `email`, `phone`, `is_active`. **UNIQUE parcial (`school_id`,`document_id`)**
  → dedupe por cédula.
- `payroll_payment_methods` — uno o varios por beneficiario: `method_type`
  (`transfer`/`mobile_payment`/`cash`/`check`), `config` JSONB (banco/cuenta/teléfono/titular),
  `is_default`.
- `payroll_periods` — `period_type` (`biweekly`/`monthly`), `start_date`/`end_date`, `status`.
- `payroll_concepts` — `concept_kind` (`earning`/`deduction`), `default_amount`, `currency`;
  el **neto se calcula**, no se escribe a mano.
- `payroll_payments` — `status` (`draft→approved→paid→voided`), `currency`+`exchange_rate`+
  `net_amount_ves` (multimoneda Bs/USD, reutiliza `bcv_rates`), `payment_method_id`, columnas
  de auditoría. **UNIQUE parcial (`period_id`,`beneficiary_id`) WHERE status<>'voided'** →
  no pagar dos veces el mismo período.
- `payroll_payment_items` — líneas por concepto (earnings/deductions).
- `payroll_audit_log` — quién creó/aprobó/pagó/anuló y cuándo.

### Endpoints / Edge Functions
- `send-payroll-receipt` — al marcar **pagado**, envía el recibo por correo al beneficiario
  (HTML), autorizando al llamador contra el `school_id` del pago.
- `send-payroll-monthly-report` — resumen mensual por colegio (totales por categoría y
  método + gráfico SVG) al **owner** del colegio; modo sistema/cron por JWT `service_role`,
  omite colegios sin pagos ese mes. Ambas reutilizan `supabase/functions/_shared/smtp-client.ts`
  (SMTP/Mailgun) y `_shared/payrollEmail.ts`. Los **asuntos van en ASCII** (`asciiSubject`)
  para evitar corrupción RFC 2047 del cliente SMTP compartido.
- Cron `payroll-monthly-report` (`0 6 1 * *`, pg_cron + pg_net): invoca el reporte mensual;
  lee `service_role_key` y `project_url` de **Supabase Vault** (sin secretos en el repo).

### Lista de bancos (reutilizada)
El campo **Banco** de los métodos de pago usa la lista canónica **`src/lib/venezuelan-banks.ts`**
(`VENEZUELAN_BANKS`, código + nombre), la misma que usa el registro de pagos de familias
(`PaymentReportModal`). El valor guardado es el **nombre** del banco.

### Datos del método copiables (copiar/pegar)
Para facilitar registrar el pago en la banca del colegio, los datos del método se muestran
**un dato por línea, cada uno con su ícono de copiar al portapapeles** (no todo junto):
- En **Registro de Nómina** hay una columna **"Método principal"** que muestra el método
  predeterminado de cada beneficiario (banco, N° de cuenta, titular…) y además la **cédula**
  y el **teléfono** del beneficiario, cada campo con su botón de copiar.
- En el **modal de registro de pago**, al seleccionar un método aparece un bloque
  "Datos para el pago" con los mismos campos copiables.
- En el **modal de métodos** cada método guardado lista sus datos igual.

Piezas de código: `src/lib/payroll/methodFields.ts` (`METHOD_FIELDS` + `methodLabeledValues`,
define qué campos guarda cada tipo de método), `src/components/payroll/MethodDetails.tsx`
(vista de datos copiables + `CopyableField` reutilizable), `src/components/payroll/CopyButton.tsx` (botón de copiar),
`src/hooks/payroll/usePayrollDefaultMethods.ts` (método principal por beneficiario para la tabla).

### Reglas de negocio (nómina)
- Segregación: `payroll.register` elabora, `payroll.approve` aprueba/paga (más `payroll_audit_log`).
- Un beneficiario solo puede tener **un pago vivo por período** (los anulados no cuentan).
- Multimoneda VES/USD con tasa por pago; el neto en VES sale de `net_amount * exchange_rate`.
- Docentes se reutilizan desde `teachers` (categoría "Docente"); el resto se registra a mano.

### Archivos clave (nómina)
- `src/pages/school/PayrollDashboard.tsx`, `PayrollRegistration.tsx`, `PayrollBeneficiaries.tsx`, `PayrollConfig.tsx`
- `src/components/payroll/*` (modales de pago, beneficiario, métodos, historial; tabs de conceptos/períodos)
- `src/hooks/payroll/*` (React Query: beneficiarios, métodos, períodos, conceptos, pagos, etc.)
- `src/lib/payroll/*` (`calculateNet`, `buildPayrollReceiptData`, `payrollExcel`, `generatePayrollReceiptPdf`, con tests)
- `supabase/migrations/20260709120000_create_payroll_module_schema.sql`, `20260709130000_payroll_monthly_report_cron.sql`

## Por documentar
- Modelo de conceptos de cobro y cuotas, y cálculo de saldo (`student_concept_balances`).
  *(La detección de morosos y el pipeline de recordatorios ya están documentados arriba.)*
