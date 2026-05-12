## Diagnóstico

El error sigue porque el cambio anterior solo ajustó el `select` del frontend con `!payment_items_payment_id_fkey`, pero en el VPS esa llave foránea no existe realmente en PostgreSQL o no está en el cache de PostgREST.

Al revisar el repositorio, ya existe una migración canónica para varias relaciones del módulo de pagos, pero solo cubre:

- `payment_plan_concepts`
- `student_payment_plans`
- `student_concept_balances`

No incluye las relaciones nuevas que necesita el historial de pagos:

- `payment_items.payment_id -> payments.id`
- `payment_items.plan_concept_id -> payment_plan_concepts.id`
- `payment_method_entries.payment_id -> payments.id`
- relaciones base de `payments` hacia estudiante/colegio/año escolar

Por eso en Lovable Cloud puede funcionar, pero en VPS falla: el esquema local quedó incompleto igual que las veces pasadas.

## Plan de corrección

1. Crear una nueva migración idempotente para completar la integridad del historial de pagos en VPS:
   - Verificar que existan claves únicas/primarias en `payments.id`, `payment_items.id`, `payment_method_entries.id`.
   - Crear, si faltan, las FK:
     - `payments_school_id_fkey`
     - `payments_school_year_id_fkey`
     - `payments_student_id_fkey`
     - `payment_items_payment_id_fkey`
     - `payment_items_plan_concept_id_fkey`
     - `payment_method_entries_payment_id_fkey`
   - Usar `ON DELETE CASCADE` en las relaciones hijas para que al eliminar un pago se eliminen sus conceptos y métodos.
   - Fallar explícitamente si existen datos huérfanos, para no crear relaciones inválidas silenciosamente.
   - Enviar `NOTIFY pgrst, 'reload schema'` al final.

2. Actualizar `scripts/run-migrations.sh` para que el VPS valide también estas FK críticas después de migrar:
   - Si falta una FK del historial de pagos, `sat-migrations` debe fallar con un mensaje claro.
   - Esto evita que el despliegue quede “verde” pero PostgREST siga sin poder resolver el historial.

3. Mantener el frontend como está:
   - La consulta con `payment_items!payment_items_payment_id_fkey` es correcta.
   - No conviene reemplazarla por consultas manuales porque ocultaría el problema real del esquema.

4. Al aplicar en VPS:
   - Ejecutar el runner de migraciones.
   - Reiniciar `supabase-rest` si el cache no recarga inmediatamente.

## Validación esperada

Después de migrar en VPS, esta relación debe existir:

```sql
payment_items(payment_id) -> payments(id)
```

y la URL del historial debe dejar de devolver `PGRST200`.