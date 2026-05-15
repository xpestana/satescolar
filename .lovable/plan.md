# Plan: Reporte de Pagos por Representantes + Confirmación Escolar

## 1. Base de datos

### Nueva tabla `payment_reports` (reportes de pago hechos por familias, pendientes de confirmar)
Campos:
- `school_id`, `student_id`, `school_year_id`, `family_id`, `reported_by` (user_id)
- `plan_concept_id` (cuota seleccionada) + snapshot `concept_name`, `amount`, `currency`
- `school_payment_method_id` (a qué método/cuenta del colegio envió el dinero)
- `payer_method` (transferencia, pago_movil, zelle, efectivo, etc.)
- `payer_bank_name`, `payer_phone`, `payer_document`, `payer_account_email` (zelle), `payer_account_holder` (zelle)
- `reference_code`, `payment_date`, `amount_reported`, `currency_reported`
- `receipt_url` (capture obligatorio en bucket `payment-receipts`)
- `status`: `pending` | `confirmed` | `rejected`
- `confirmed_payment_id` (FK a `payments`), `confirmed_by`, `confirmed_at`, `rejection_reason`
- `created_at`, `updated_at`

RLS:
- Familia: insertar/ver sólo sus reportes (vía `families.user_id`)
- Colegio: ver/actualizar reportes de su `school_id` (`user_roles`)
- Admin: full

### Bucket Storage `payment-receipts` (privado)
Políticas: familias suben en path `{school_id}/{family_id}/...`; colegio y admin leen los de su escuela.

### `payments` — agregar columna obligatoria `invoice_number TEXT NOT NULL DEFAULT ''`
Trigger/check: requerir no vacío en INSERT nuevo (validación se hace en frontend + edge si hace falta).

## 2. Frontend Representante

Nueva sección **Pagos** en sidebar de representante:

**`/representative/pagos`** — Dashboard de pagos
- Lista de estudiantes de la familia
- Por cada uno: cuotas pendientes y vencidas (de `student_concept_balances` filtrado por `balance > 0`)
- Etiqueta "Cuota pendiente" (nunca "moroso") en rojo cuando la fecha límite ya pasó
- Aviso visible en `RepresentativeDashboard` cuando existan cuotas vencidas: "Tienes cuotas pendientes por pagar"
- Botón "Reportar pago" por cuota → abre modal

**`PaymentReportModal`** (nuevo)
- Estudiante (preseleccionado), Cuota (preseleccionada), Monto
- Método de pago del colegio (select desde `payment_methods` del colegio, muestra banco/cuenta destino)
- Método del pagador (transferencia / pago_movil / zelle / etc.)
- Campos dinámicos según método:
  - Transferencia/Pago móvil: banco origen, teléfono, cédula del titular, referencia, fecha
  - Zelle: email cuenta, nombre del titular, referencia
- **Capture obligatorio** (S3 upload, valida no submit sin archivo)
- Submit → inserta en `payment_reports` con `status=pending`

**`/representative/pagos/historial`** — historial de reportes con estado (pendiente/confirmado/rechazado)

## 3. Frontend Colegio

**`/school/pagos/reportes`** (nuevo) — Lista de reportes pendientes
- Tarjetas/tabla con: estudiante, representante, cuota, monto, método, banco, referencia, fecha
- Miniatura del capture → click abre modal grande con zoom
- Acciones: **Confirmar** | **Rechazar** (con motivo)
- Confirmar → abre `PaymentFormModal` precargado con: estudiante, cuota, método, banco, referencia, monto, fecha. Sólo falta confirmar y poner **N° de factura**. Al guardar enlaza `payment_reports.confirmed_payment_id` y cambia `status=confirmed`.

Badge en sidebar con cantidad de reportes pendientes.

## 4. N° de factura obligatorio en `PaymentFormModal`

- Agregar input `invoice_number` requerido (validación zod)
- Aplica a TODO ingreso de pago (registro manual o vía confirmación de reporte)
- Mostrar el número en `PaymentHistoryModal` y recibos

## 5. Detalles técnicos

- Edge function nueva NO necesaria; se usa SDK de Supabase con RLS.
- Subida de capture: reutilizar `s3-sign-upload` existente apuntando al nuevo bucket.
- Realtime opcional en `payment_reports` para badge de pendientes.
- Permisos: nueva clave `payments.reports.manage` para que el escolar vea/confirme reportes.

## Archivos a crear/editar

Crear:
- `supabase/migrations/<ts>_payment_reports.sql`
- `src/pages/representative/RepPayments.tsx`
- `src/pages/representative/RepPaymentHistory.tsx`
- `src/components/payments/PaymentReportModal.tsx`
- `src/pages/school/PaymentReportsList.tsx`
- `src/components/payments/ReceiptViewerModal.tsx`

Editar:
- `src/components/payments/PaymentFormModal.tsx` (agregar `invoice_number` + modo "desde reporte")
- `src/pages/representative/RepresentativeDashboard.tsx` (alerta cuotas pendientes)
- `src/components/layout/AppSidebar.tsx` (entradas nuevas + badge)
- `src/App.tsx` (rutas)
- `src/pages/school/PaymentRegistration.tsx` y `PaymentHistoryModal.tsx` (mostrar N° factura)

## Preguntas antes de implementar

1. ¿El capture del pago debe permitir también PDF o solo imagen?
2. Cuando el escolar **rechaza** un reporte, ¿se notifica al representante por email automáticamente?
3. El N° de factura, ¿debe ser único por colegio (validación de duplicados) o solo texto libre?
