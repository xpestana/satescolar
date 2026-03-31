

# Plan: Métodos de Pago Aceptados por el Colegio

## Resumen

Agregar una tercera pestaña "Métodos de Pago" en Configuración de Pagos que permita al colegio registrar múltiples cuentas/destinos por cada tipo de método de pago (varias cuentas de transferencia, varios pago móvil, varios zelle, etc.). El título de la sección será "Métodos de Pago Aceptados por el Colegio".

## Base de datos

**Nueva tabla `school_payment_methods`:**

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid PK | |
| school_id | uuid | FK a schools |
| method_type | text | transferencia, pago_movil, zelle, efectivo, punto_venta, tarjeta_debito, tarjeta_credito |
| label | text | Nombre personalizado (ej: "Banesco Corriente", "Zelle principal") |
| config | jsonb | Datos específicos del método |
| is_active | boolean | Default true |
| display_order | integer | Default 0 |
| created_at | timestamptz | Default now() |

**Estructura del campo `config` por tipo:**
- **transferencia**: `{ bank_code, bank_name, account_number, account_holder, document_id, account_type }`
- **pago_movil**: `{ bank_code, bank_name, phone, document_id }`
- **zelle**: `{ email }`
- **efectivo**: `{ currencies: ["VES","USD","EUR","COP"] }`
- **punto_venta**: `{ bank_code, bank_name }` (opcional)
- **tarjeta_debito / tarjeta_credito**: `{ bank_code, bank_name }` (opcional)

RLS: mismas políticas que las demás tablas de pagos (school users CRUD su escuela, admins ALL).

## Frontend

### 1. Archivo `src/lib/venezuelan-banks.ts`
Constante `VENEZUELAN_BANKS` con los 27 bancos del JSON proporcionado.

### 2. Nueva pestaña en `PaymentConfig.tsx`
- Tercera tab: "Métodos de Pago" con icono `CreditCard`
- Título de la card: **"Métodos de Pago Aceptados por el Colegio"**
- Lista agrupada por tipo de método, mostrando todas las cuentas registradas
- Botón "Agregar Método" que abre dialog con:
  - Select de tipo de método
  - Label personalizado (obligatorio)
  - Campos dinámicos según tipo seleccionado:
    - **Transferencia**: Select banco venezolano, input cuenta (20 dígitos), a nombre de, cédula/RIF, tipo cuenta (corriente/ahorro)
    - **Pago Móvil**: Select banco, teléfono, cédula/RIF
    - **Zelle**: Input correo
    - **Efectivo**: Checkboxes de monedas aceptadas
    - **Punto de Venta / Tarjeta Débito / Tarjeta Crédito**: Select banco (opcional)
- Editar y eliminar cada método registrado
- Se pueden agregar múltiples registros del mismo tipo

### 3. Actualizar `PaymentFormModal.tsx`
- Reemplazar array `METHODS` hardcodeado por los métodos activos del colegio
- Al seleccionar un método, mostrar los datos de la cuenta destino como referencia visual para el operador

## Archivos a crear/modificar

| Archivo | Cambio |
|---------|--------|
| Migración SQL | Crear tabla `school_payment_methods` + RLS |
| `src/lib/venezuelan-banks.ts` | Nueva constante con lista de bancos |
| `src/pages/school/PaymentConfig.tsx` | Nueva tab "Métodos de Pago" con CRUD completo |
| `src/components/payments/PaymentFormModal.tsx` | Usar métodos configurados del colegio en vez de hardcodeados |

