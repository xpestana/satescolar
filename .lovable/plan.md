## Diagnóstico

### 1) Morosos no muestra estudiantes
La función `isOverdue` (en `src/lib/delinquency.ts`) y el filtro en `DelinquentStudents.tsx` exigen que el concepto tenga `due_day` o `due_month`. Hoy en la BD:
- Conceptos no recurrentes (matrícula, mes de agosto, etc.) tienen `due_day` y `due_month` en NULL → `isOverdue` retorna `false`.
- Conceptos recurrentes (mensualidades) tienen sólo `due_day=15` sin `due_month` → calcula vencimiento del mes actual (15 mayo) y como hoy es 12 mayo, tampoco está vencido.

Resultado: ningún balance entra al listado.

### 2) Estado de Cuenta muestra UUID en "Métodos"
En `payment_method_entries.method` se guarda el `id` del método configurado en el colegio (`school_payment_methods.id`). `StudentLedger.tsx` y `PaymentHistoryModal.tsx` lo pintan tal cual (`m.method`) en lugar de resolver el `label` del método.

---

## Plan

### A) Restaurar la morosidad

1. **Ajustar `isOverdue` (`src/lib/delinquency.ts`):**
   - Si el concepto **no** tiene `due_day` ni `due_month` → considerar **vencido** si hay saldo (compatibilidad con conceptos legacy / sin vencimiento configurado). Esto restaura el comportamiento previo.
   - Para recurrentes con `due_day` pero sin `due_month` → considerar vencido si **cualquier mes anterior** del año escolar ya pasó la fecha de corte (no solo el mes actual). Es decir: revisar desde el mes de inicio del año escolar (agosto) hasta hoy y marcar vencido si al menos un mes calendario ya completó su `due_day`.
   - Mantener la lógica actual para conceptos con `due_month` explícito.

2. **No tocar la UI** de `DelinquentStudents.tsx` — sólo cambia la utilidad.

### B) Mostrar nombre del método de pago

3. **`StudentLedger.tsx`**: cargar `school_payment_methods` (id, label) del colegio y resolver `m.method` → `label`. Si no se encuentra (método legacy con string fijo como `"transferencia"`), usar el valor crudo capitalizado.

4. **`PaymentHistoryModal.tsx`**: mismo tratamiento — pasar `schoolId` ya disponible y mapear el id al label.

### C) Validación
- Verificar que la lista de morosos ahora muestra estudiantes con saldos vencidos.
- Verificar que en estado de cuenta y en historial de pagos el método aparece como "Transferencia BNC", "Pago Móvil Banesco", etc., en lugar del UUID.

---

## Archivos a editar
- `src/lib/delinquency.ts`
- `src/pages/school/StudentLedger.tsx`
- `src/components/payments/PaymentHistoryModal.tsx`

Sin cambios de schema ni de migraciones.