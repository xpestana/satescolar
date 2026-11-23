# Clientes y cobros (CRM de SAT Escolar)

> 🧭 Al implementar cambios de este tema, sigue las [Convenciones de desarrollo](CONVENTIONS.md)
> (código en inglés, SOLID, pruebas, formato, una responsabilidad por archivo).

## Resumen
Control comercial de los colegios **como clientes de SAT Escolar**: si son cliente real, demo o
inactivo; cuánto pagan; qué meses han pagado o deben; a quién se le cobra; observaciones; y los
correos automáticos de cobro (recordatorio) y de agradecimiento (al registrar un pago).
No confundir con [12-pagos](12-pagos.md), que es el cobro **del colegio a sus familias**.

## Roles involucrados
- **admin** — único rol con acceso (RLS con `is_admin()` en todas las tablas).

## Casos de uso
- El admin crea un colegio → aparece automáticamente en Clientes como **Demo**.
- El admin lo marca como **Cliente real**, indica la cuota mensual (USD) y desde qué mes se cobra.
- Los días configurados (por defecto el **15**) a las 9:00 a. m. (Venezuela) cada cliente real con meses
  pendientes recibe un recordatorio amable con la lista de meses, el total y los datos de pago.
- El colegio paga → el admin selecciona uno o varios meses (también futuros, p. ej. pago anual), los
  registra como **Pagado** (monto, fecha, método, referencia) o **Exonerado**, y al guardar se envía
  el correo de agradecimiento.
- El cobro no se le hace al usuario principal → el admin desactiva «Enviar al usuario principal» y
  agrega otros correos (administrador, etc.). Todos reciben el mismo mensaje.
- El admin anota particularidades del colegio en **Observaciones**.

## Operaciones / Funciones
| Operación | Rol | Ruta | Descripción |
|---|---|---|---|
| Lista de clientes | admin | `/admin/clientes` | KPIs (clientes, demos, ingreso mensual, por cobrar, demos por vencer), filtros y búsqueda. |
| Ajustes de cobro | admin | `/admin/clientes` (botón) | Días del recordatorio, datos de pago, WhatsApp para comprobantes. |
| Ficha del cliente | admin | `/admin/clientes/:id` | Estado de cobro, enviar recordatorio ahora, vista previa, WhatsApp, meses, pagos, datos, destinatarios, observaciones, historial de correos. |

## Endpoints / Edge Functions
- `client-billing` (`verify_jwt = false`; valida rol admin o service-role verificado):
  - `run_reminders` — cron diario `client-billing-reminders` (13:00 UTC). Solo envía si hoy (hora de
    Caracas) está en `reminder_days`; un recordatorio por cliente por día. `force: true` ignora el día.
  - `send_reminder` — admin, un cliente, ahora.
  - `register_payment` — admin: guarda los meses (upsert por mes) y, si `send_thanks`, envía el agradecimiento.

## Datos / Tablas (Supabase)
- `client_accounts` — una por colegio (`school_id` único). `account_type` demo/client/inactive,
  `monthly_fee_usd`, `billing_start_month` (día 1), `demo_ends_on`, `contact_name`, `contact_phone`,
  `notify_owner`, `reminders_enabled`, `observations`. Trigger `create_client_account_on_school_insert`.
- `client_billing_contacts` — correos adicionales de cobro (`is_active` para pausar).
- `client_billing_payments` — un registro por mes (`period_month`, único por cliente), `status` paid/waived.
- `client_billing_emails` — historial de recordatorios y agradecimientos (destinatarios, meses, resultado).
- `client_billing_settings` — fila única: `reminder_days`, `payment_instructions`, `contact_phone`.
- RPC `admin_school_owner_contacts()` — correos de los usuarios principales (`user_roles.is_owner`).

## Reglas de negocio
- **Meses pendientes** = desde `billing_start_month` hasta el mes actual (Caracas), sin pagar ni exonerar.
  Demos e inactivos no generan deuda ni reciben recordatorios.
- **Destinatarios** = usuario(s) principal(es) si `notify_owner` + contactos activos; sin duplicados.
- Sin destinatarios el envío se registra como fallido en el historial.
- Quitar un mes del historial lo vuelve a dejar pendiente (no envía correos).
- Los textos de correo se construyen en `_shared/billing/billingEmails.ts`; la vista previa del admin usa
  el mismo código.

## Archivos clave (código)
- `supabase/functions/client-billing/index.ts`
- `supabase/functions/_shared/billing/` — `billingMonths.ts`, `billingRecipients.ts`, `billingEmails.ts`, `clientBillingData.ts`
- `src/lib/clients/` — `clientBillingStatus.ts`, `whatsappReminder.ts`, `currentMonthKey.ts`
- `src/hooks/clients/`
- `src/components/admin/clients/`
- `src/pages/admin/ClientsList.tsx`, `src/pages/admin/ClientDetail.tsx`
- `supabase/migrations/20261123210000_client_billing.sql`
