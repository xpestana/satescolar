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
- `send-delinquency-reminders` — recordatorios de morosidad.
- `fetch-bcv-rates` — tasa de cambio BCV para conversión de montos.

## Configuración de Pagos (`/pagos/configuracion`)
Pantalla `PaymentConfig` ("Configuración de Pagos") con **4 pestañas**:
- **Conceptos** (`payment_concepts`) — conceptos de cobro (matrícula, mensualidad, etc.).
- **Planes** (`payment_plans` + `payment_plan_concepts`) — planes que agrupan conceptos.
- **Métodos de Pago** — métodos disponibles (ver `PaymentMethodsTab`).
- **Configuraciones** — ajustes generales de facturación (ligado a `useBillingMode`).

## Configuración de Morosidad (`/pagos/morosidad`)
Pantalla `DelinquencyConfig` ("Configuración de Morosidad"): reglas/avisos de morosidad
en `delinquency_config`; alimenta la función `send-delinquency-reminders`.

## Datos / Tablas (Supabase)
- `invoice_templates` — plantillas de formato de factura: `school_id`, `config` (JSON),
  `is_active` (una sola activa por colegio).
**Configuración (catálogo):**
- `payment_concepts` — conceptos de cobro: `concept_type`, `currency`, `default_amount`, `is_active`.
- `payment_plans` — planes; `payment_plan_concepts` — conceptos del plan con
  `amount`, `discount_type`/`discount_value`, `due_day`/`due_month`, `is_recurring`, `is_mandatory`.
- `school_payment_methods` — métodos de pago configurados: `method_type`, `label`,
  `config` (JSON), `is_active`.
- `delinquency_config` — reglas de morosidad.

**Asignación y saldos (estado de cuenta):**
- `student_payment_plans` — plan asignado a un estudiante por año escolar.
- `student_concept_balances` — **el ledger**: saldo por estudiante × `plan_concept` × año:
  `total_amount`, `paid_amount`, `balance`, `status`, `currency`,
  `exchange_rate_snapshot`, `last_payment_date`. Fuente del estado de cuenta y morosidad.

**Pagos / factura:**
- `payments` — comprobante/factura emitida: `control_number`, `invoice_number`,
  `invoice_name`/`invoice_rif`/`invoice_address`/`invoice_phone`, `total_amount_ves`,
  `status`, anulación (`voided_at`/`voided_by`/`void_reason`), `student_id`, `school_year_id`.
- `payment_items` — líneas del pago: `plan_concept_id`, `amount_ves`, `is_partial`.
- `payment_method_entries` — pago **multi-método**: por entrada `method`, `currency`,
  `amount_original`, `amount_ves`, `exchange_rate`, `bank_name`, `reference_code`.
- `payment_reports` — pagos **reportados por la familia** pendientes de confirmar
  (`confirmed_at`/`confirmed_payment_id`).

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

## Reglas de negocio
- **El formato de factura se define en `/formatos` (tabla `invoice_templates`) y la
  emisión/impresión debe respetarlo** — mismo patrón que la boleta en notas.
- Solo una plantilla de factura activa por colegio.
- **Estado de cuenta / morosidad** se calculan sobre `student_concept_balances`
  (`total_amount` − `paid_amount` = `balance`), no sobre `payments` directamente.
- Al asignar un plan (`student_payment_plans`) se generan los balances por concepto
  (ver funciones `create_missing_student_concept_balances_*`,
  `rebuild_student_concept_balances_for_active_year`).
- Montos se manejan en **VES** con `exchange_rate` por entrada; la conversión usa
  `bcv_rates`/`exchange_rates` (función `fetch-bcv-rates`).
- Un pago puede **anularse** (`voided_*`) y admite **múltiples métodos** por comprobante.
- Las familias pueden **reportar** pagos (`payment_reports`) que el colegio confirma,
  generando el `payments` definitivo.

## Archivos clave (código)
- `src/pages/school/FormatsConfig.tsx` (contenedor de pestañas Facturas/Boletas)
- `src/components/payments/InvoiceFormatTab.tsx` (editor de formato de factura)
- `src/lib/buildInvoiceData.ts`, `src/hooks/useBillingMode.ts`
- `src/components/payments/PaymentMethodsTab.tsx`, `src/components/payments/...`

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
- Modelo de conceptos de cobro, cuotas y cálculo de saldo/morosidad.
