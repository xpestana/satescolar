## Objetivo
Corregir el fallo PGRST200 en el VPS de forma estructural, no con un workaround, asegurando que el esquema local Docker tenga las mismas relaciones reales que Lovable Cloud y que PostgREST pueda resolver correctamente los embeds:

- `student_payment_plans -> payment_plans`
- `student_concept_balances -> payment_plan_concepts`
- `payment_plan_concepts -> payment_concepts`
- `payment_plan_concepts -> payment_plans`

## Diagnóstico
En Lovable Cloud las relaciones existen correctamente. El problema está en el VPS porque las migraciones locales del repositorio no contienen la creación completa/original del esquema de pagos; solo hay migraciones recientes que intentan añadir algunas FK y columnas. Eso deja el VPS dependiendo de un estado previo/importado y puede terminar con tablas sin constraints formales, aunque los datos existan.

Las consultas del frontend son correctas y siguen buenas prácticas de PostgREST, por ejemplo:

```text
student_payment_plans?select=*,payment_plans(name)
student_concept_balances?select=*,payment_plan_concepts(...)
```

PostgREST solo puede resolver esas consultas si existen llaves foráneas reales en PostgreSQL.

## Plan de implementación

1. **Crear una migración canónica e idempotente de integridad para pagos**
   - No será un parche manual para un solo error.
   - Será una migración de esquema que declara formalmente las relaciones esperadas del módulo de pagos.
   - Validará/creará constraints faltantes de forma segura usando nombres estándar:
     - `student_payment_plans_plan_id_fkey`
     - `student_payment_plans_student_id_fkey`
     - `student_payment_plans_school_id_fkey`
     - `student_payment_plans_school_year_id_fkey`
     - `student_concept_balances_plan_concept_id_fkey`
     - `student_concept_balances_student_id_fkey`
     - `student_concept_balances_school_id_fkey`
     - `student_concept_balances_school_year_id_fkey`
     - `payment_plan_concepts_plan_id_fkey`
     - `payment_plan_concepts_concept_id_fkey`
   - También asegurará claves primarias/únicas necesarias para que esas FK sean válidas.

2. **Hacer la migración robusta para bases existentes del VPS**
   - Antes de crear cada FK, revisar si ya existe una relación equivalente aunque tenga otro nombre.
   - Evitar duplicar constraints.
   - No borrar datos.
   - Si hay datos huérfanos, la migración debe fallar explícitamente con un mensaje claro en lugar de crear relaciones inválidas silenciosamente.
   - Mantener `ON DELETE CASCADE` igual que el esquema válido de Lovable Cloud.

3. **Completar el esquema local de pagos si faltan tablas en instalaciones nuevas**
   - Revisar si las tablas de pagos fueron creadas por una migración ausente del repositorio.
   - Si falta una migración base, crear una migración canónica que use `CREATE TABLE IF NOT EXISTS` para las tablas del módulo de pagos y sus RLS/policies según el patrón multi-tenant por `school_id`.
   - Esto evita que un VPS nuevo o reconstruido quede con un esquema parcial.

4. **Ajustar el runner de migraciones Docker con buenas prácticas**
   - Mantener `NOTIFY pgrst, 'reload schema'` al final.
   - Añadir una verificación post-migración de relaciones críticas de pagos.
   - Si alguna FK crítica no existe, el contenedor `sat-migrations` debe fallar con un error claro antes de levantar la app.
   - Esto previene despliegues “verdes” con PostgREST sin relaciones.

5. **No tocar las consultas del frontend salvo que se detecte una relación ambigua real**
   - El frontend está consultando relaciones correctas.
   - Cambiarlo para hacer joins manuales sería peor práctica y ocultaría el problema de esquema.
   - Solo se ajustaría frontend si una relación queda intencionalmente ambigua y requiere `!constraint_name`, pero no parece ser el caso.

6. **Entregar comandos de despliegue correctos para VPS**
   - Ejecutar migraciones.
   - Reiniciar/recargar PostgREST después de migrar si el `NOTIFY` no alcanza por el ciclo del contenedor.
   - Reconstruir app solo si hubo cambios frontend; para esta corrección probablemente bastará con migraciones/rest.

## Validación esperada
Después de aplicar la migración en VPS:

```text
SELECT conname FROM pg_constraint
WHERE conrelid IN (
  'public.student_payment_plans'::regclass,
  'public.student_concept_balances'::regclass,
  'public.payment_plan_concepts'::regclass
)
AND contype = 'f';
```

debe mostrar las FK críticas, y estas URLs deben dejar de devolver PGRST200:

```text
student_payment_plans?select=*,payment_plans(name)
student_concept_balances?select=*,payment_plan_concepts(...)
```

## Resultado
El VPS quedará alineado con Lovable Cloud a nivel de integridad relacional, con migraciones reproducibles, verificables e idempotentes.