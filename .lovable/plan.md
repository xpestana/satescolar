

# Plan: Módulo Completo de Pagos Escolar

## Resumen

Construir un sistema de pagos multi-moneda con configuración de planes, registro de pagos dinámicos, control de morosidad, recordatorios automáticos por correo y panel administrativo completo. Se integra con la infraestructura existente de escuelas, años escolares, inscripciones y el sistema de correo SMTP.

---

## Fase 1: Base de Datos (Migración SQL)

### Tablas a crear:

1. **`payment_concepts`** — Catálogo reutilizable de conceptos
   - `id`, `school_id`, `name`, `description`, `default_amount` (VES), `concept_type` (inscripcion, mensualidad, uniforme, transporte, laboratorio, otro), `is_active`, `created_at`, `updated_at`

2. **`payment_plans`** — Planes de pago
   - `id`, `school_id`, `name`, `description`, `is_active`, `created_at`, `updated_at`

3. **`payment_plan_concepts`** — Relación M:N plan-concepto con metadatos
   - `id`, `plan_id`, `concept_id`, `amount` (monto específico en ese plan), `display_order`, `is_mandatory`, `is_recurring`, `due_day` (día del mes de vencimiento), `created_at`
   - UNIQUE(plan_id, concept_id)

4. **`student_payment_plans`** — Asignación plan-alumno por año escolar
   - `id`, `school_id`, `student_id`, `school_year_id`, `plan_id`, `assigned_at`, `created_at`
   - UNIQUE(student_id, school_year_id)

5. **`exchange_rates`** — Tasas de cambio vigentes del colegio
   - `id`, `school_id`, `currency` (USD, EUR, COP), `rate_to_ves`, `updated_at`, `updated_by`

6. **`payments`** — Cabecera de pagos
   - `id`, `school_id`, `student_id`, `school_year_id`, `payment_date`, `total_amount_ves`, `observations`, `invoice_rif`, `invoice_name`, `invoice_address`, `invoice_phone`, `status` (completed, voided), `void_reason`, `voided_by`, `voided_at`, `created_by`, `created_at`, `updated_at`

7. **`payment_items`** — Detalle de conceptos pagados por pago
   - `id`, `payment_id`, `plan_concept_id`, `amount_ves`, `is_partial`, `created_at`

8. **`payment_methods`** — Métodos de pago por transacción
   - `id`, `payment_id`, `method` (transferencia, efectivo, pago_movil, zelle, punto_venta), `bank_name`, `reference_code`, `amount_original`, `currency` (VES, USD, EUR, COP), `exchange_rate`, `amount_ves`, `payment_date`, `details`, `created_at`

9. **`student_concept_balances`** — Vista materializada o tabla de saldos
   - `id`, `school_id`, `student_id`, `school_year_id`, `plan_concept_id`, `total_amount`, `paid_amount`, `balance`, `status` (pending, partial, paid, overdue, voided), `last_payment_date`, `updated_at`

10. **`delinquency_config`** — Configuración de morosidad por colegio
    - `id`, `school_id`, `overdue_after_day` (día del mes), `reminder_mode` (never, daily, weekly, monthly), `reminder_days_of_week` (jsonb), `reminder_days_of_month` (jsonb), `created_at`, `updated_at`

11. **`delinquency_notifications`** — Historial de recordatorios enviados
    - `id`, `school_id`, `student_id`, `family_id`, `email_sent_to`, `concepts_detail` (jsonb), `total_owed_ves`, `sent_at`, `status` (sent, failed), `error_message`, `created_at`

### RLS Policies
- Todas las tablas: admin ALL, school users CRUD para su school_id
- Patrón existente: `EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND school_id = table.school_id)`

### Trigger
- `update_updated_at_column` en tablas que lo requieran (ya existe la función)

---

## Fase 2: Edge Functions

### 2a. `process-delinquency-reminders`
- Cron job diario que:
  1. Lee `delinquency_config` de cada colegio
  2. Evalúa si hoy corresponde enviar según el modo configurado
  3. Identifica alumnos morosos (saldo > 0 y pasado el día de vencimiento)
  4. Envía correo al email de la familia usando SMTP (mismo patrón que `send-email`)
  5. Registra en `delinquency_notifications`
  6. Template HTML profesional, respetuoso y formal con datos dinámicos

### 2b. Programar cron job con `pg_cron` + `pg_net`

---

## Fase 3: Frontend — Páginas

### 3a. Configuración de Pagos (`/school/configuraciones/pagos`)
- **Tab 1: Conceptos de Pago** — CRUD de conceptos reutilizables (nombre, tipo, monto por defecto)
- **Tab 2: Planes de Pago** — CRUD de planes. Al editar un plan, modal para asociar conceptos con monto, orden, obligatorio, recurrente, día de vencimiento
- **Tab 3: Tasas de Cambio** — Editar tasas USD/EUR/COP a VES
- **Tab 4: Morosidad** — Configurar día de mora, modo de recordatorio, días específicos

### 3b. Registro de Pagos (`/pagos/registro`)
- Lista de estudiantes del año escolar activo con: nombre, plan, grado, sección, saldo pendiente, badge morosidad
- Buscador inteligente
- Al seleccionar alumno → formulario de registro:
  - Info del alumno (nombre, plan, grado, sección)
  - Datos de factura (pre-cargados del representante, editables)
  - Lista de conceptos con checkboxes (pendientes/parciales/pagados), montos, saldo
  - Formulario dinámico de múltiples formas de pago (agregar/eliminar líneas)
  - **Widget flotante de tasas de cambio** (panel fijo/sticky con inputs editables USD/EUR/COP→VES)
  - Resumen final con validación antes de guardar
  - Campo de observaciones

### 3c. Morosos (`/pagos/morosos`)
- Tabla de alumnos morosos con: nombre, plan, grado, sección, representante, correo familia, conceptos vencidos, monto, antigüedad, último recordatorio, próximo
- Filtros: grado, sección, plan, rango de deuda, antigüedad, búsqueda
- Exportar PDF/Excel
- Botón reenviar recordatorio manual

### 3d. Estado de Cuenta (`/pagos/estado-cuenta`)
- Seleccionar alumno → historial de cargos y abonos
- Saldo total, conceptos pagados/pendientes
- Filtros por período
- Generar recibo/comprobante PDF descargable por pago

### 3e. Dashboard de Pagos (widget en SchoolDashboard o página dedicada)
- Total recaudado hoy / mes
- Alumnos morosos
- Deuda acumulada
- Pagos recientes
- Resumen por método de pago

---

## Fase 4: Sidebar y Rutas

### Sidebar — Nueva sección "Pagos"
```
Pagos
├── Registro de Pagos
├── Morosos
├── Estado de Cuenta
```

### Ajustes del Colegio — Agregar
```
├── Pagos (configuración)
```

### Rutas en App.tsx
- `/school/configuraciones/pagos` → PaymentsConfig
- `/pagos/registro` → PaymentRegistration
- `/pagos/morosos` → DelinquentStudents
- `/pagos/estado-cuenta` → AccountStatement

---

## Fase 5: Componentes Clave

1. **`ExchangeRateWidget`** — Panel flotante/sticky con inputs para USD/EUR/COP→VES, actualiza estado local y guarda en BD
2. **`PaymentMethodRow`** — Línea dinámica de forma de pago (método, banco, referencia, monto, moneda, tasa, conversión)
3. **`ConceptSelector`** — Lista de conceptos con checkboxes, estados visuales, soporte pago parcial
4. **`PaymentReceiptPDF`** — Generación de recibo con jsPDF usando el header institucional existente
5. **`DelinquencyConfigForm`** — Formulario de configuración de morosidad con opciones de frecuencia

---

## Detalles Técnicos

- **Multi-moneda**: Cada `payment_method` guarda `amount_original`, `currency`, `exchange_rate`, `amount_ves`. La tasa se guarda como snapshot histórico.
- **Pagos parciales**: `student_concept_balances` mantiene `paid_amount` y `balance`. Al registrar pago parcial, se actualiza el saldo.
- **Anulación**: Campo `status` en `payments` con `void_reason`, `voided_by`, `voided_at`. Al anular se revierten los saldos.
- **Descuentos/becas**: Campo `amount` en `payment_items` puede ser menor al monto del concepto, con observación justificativa.
- **Recibos**: PDF con detalle de conceptos, formas de pago, tasas usadas, header institucional.
- **Trazabilidad**: `created_by`, `voided_by`, timestamps en todas las operaciones.

---

## Archivos a crear/modificar

| Archivo | Acción |
|---------|--------|
| Migración SQL | ~12 tablas, RLS, triggers |
| `supabase/functions/process-delinquency-reminders/index.ts` | Edge function + cron |
| `src/pages/school/PaymentsConfig.tsx` | Configuración (conceptos, planes, tasas, morosidad) |
| `src/pages/school/PaymentRegistration.tsx` | Registro de pagos |
| `src/pages/school/DelinquentStudents.tsx` | Morosos |
| `src/pages/school/AccountStatement.tsx` | Estado de cuenta |
| `src/components/payments/ExchangeRateWidget.tsx` | Widget flotante tasas |
| `src/components/payments/PaymentMethodRow.tsx` | Línea de forma de pago |
| `src/components/payments/ConceptSelector.tsx` | Selector de conceptos |
| `src/components/payments/PaymentReceiptPDF.tsx` | Generador de recibo |
| `src/components/payments/DelinquencyConfigForm.tsx` | Config morosidad |
| `src/components/payments/PaymentForm.tsx` | Formulario principal de pago |
| `src/components/layout/AppSidebar.tsx` | Agregar sección Pagos |
| `src/App.tsx` | Agregar rutas |
| `supabase/config.toml` | Agregar función con verify_jwt = false |

---

## Orden de implementación

1. Migración SQL (todas las tablas, RLS, triggers)
2. Configuración de Pagos (conceptos + planes + tasas + morosidad)
3. Registro de Pagos (formulario completo con widget de tasas)
4. Morosos (listado con filtros y exportación)
5. Estado de Cuenta (historial + recibos PDF)
6. Edge Function de recordatorios + cron job
7. Sidebar + rutas + integración final

