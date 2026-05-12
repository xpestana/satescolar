# Conceptos de Pago multi-moneda

Hoy los `payment_concepts` y `payment_plan_concepts` solo manejan VES. Vamos a permitir que cada concepto se cree en la moneda que el colegio prefiera (VES, USD, EUR, COP) y la conversión a VES (moneda contable) ocurre con la tasa BCV vigente al momento de asignar el plan al estudiante.

## Cambio de base de datos

Migración nueva `add_currency_to_payment_concepts`:

- `payment_concepts`
  - Añadir `currency text NOT NULL DEFAULT 'VES'` con CHECK en (`VES`,`USD`,`EUR`,`COP`).
- `payment_plan_concepts`
  - Añadir `currency text` (nullable → hereda del concepto).
  - El `amount` existente se interpreta en esa moneda.
- `student_concept_balances` (snapshot al asignar el plan)
  - `currency text NOT NULL DEFAULT 'VES'`
  - `original_amount numeric` — monto en la moneda del concepto.
  - `exchange_rate_snapshot numeric NOT NULL DEFAULT 1` — tasa usada para convertir a VES.
  - `total_amount` sigue en VES (= `original_amount * exchange_rate_snapshot`).

Datos existentes: todos quedan en `VES` con `exchange_rate_snapshot = 1`, sin pérdida.

## Cambios de UI

### `PaymentConfig.tsx` – Conceptos
- Modal "Editar/Crear Concepto": agregar `Select` de Moneda (VES/USD/EUR/COP) junto al campo "Tipo".
- Cambiar label "Monto por defecto (VES)" → "Monto por defecto ({currency})".
- Tabla de conceptos: nueva columna **Moneda**; el monto se muestra con su símbolo/sufijo correcto.

### `PaymentConfig.tsx` – Planes (sub-conceptos del plan)
- Al añadir un concepto a un plan: precarga `currency` del concepto y permite override opcional.
- Listado de conceptos del plan: muestra `monto + moneda` y, si no es VES, el equivalente VES estimado a tasa actual.

### `PaymentRegistration.tsx` – Asignación de plan
- En `assignPlanMut`, además de insertar `student_payment_plans`, insertar las filas de `student_concept_balances` haciendo snapshot:
  - Tomar la tasa BCV actual de `exchange_rates` para la moneda de cada concepto.
  - Guardar `currency`, `original_amount`, `exchange_rate_snapshot`, `total_amount` (= original × tasa), `paid_amount = 0`, `balance = total_amount`, `status = 'pending'`.
- Esto fija el monto en bolívares al momento de asignar el plan y el alumno no se ve afectado por fluctuaciones posteriores.

### `PaymentFormModal.tsx`, `StudentLedger.tsx`, `PaymentDashboard.tsx`, `DelinquentStudents.tsx`
- En cada fila de balance mostrar: `original_amount {currency}` y entre paréntesis el `total_amount VES` cuando difiere.
- La cobranza, items de pago y métodos siguen exactamente igual (todo en VES contable).

## Notas técnicas

- Memoria del proyecto ya establece: "DB strict in VES, multi-currency UI uses snapshots." Esta solución respeta esa regla — VES sigue siendo la única moneda contable; el concepto solo guarda en qué moneda fue **denominado**, y al momento de asignarlo a un estudiante se congela su valor en VES.
- No hay triggers actuales que creen `student_concept_balances`; la creación explícita queda dentro de `assignPlanMut` (front-end).
- `exchange_rates` ya contiene USD/EUR/COP, no requiere cambios.
- No se modifican Edge Functions de cobranza ni morosidad: siguen leyendo `balance` en VES.

## Archivos a tocar

```text
supabase/migrations/<timestamp>_add_currency_to_payment_concepts.sql   (nuevo)
src/pages/school/PaymentConfig.tsx                                     (UI conceptos + planes)
src/pages/school/PaymentRegistration.tsx                               (snapshot al asignar plan)
src/components/payments/PaymentFormModal.tsx                           (mostrar moneda original)
src/pages/school/StudentLedger.tsx                                     (mostrar moneda original)
src/pages/school/PaymentDashboard.tsx                                  (opcional: mostrar moneda)
src/pages/school/DelinquentStudents.tsx                                (opcional: mostrar moneda)
```
