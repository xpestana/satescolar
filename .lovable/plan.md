## Plan

1. Crear una migración nueva que agregue una función SQL idempotente para reconstruir saldos faltantes de morosidad.
   - La función llenará `student_concept_balances` para todo estudiante con plan asignado en el año escolar activo.
   - Solo insertará balances que no existan; no duplicará saldos ni tocará pagos ya registrados.
   - La fecha de morosidad se calculará por `due_month` + `due_day` dentro del año escolar activo: por ejemplo, si hoy es 12/05 y el vencimiento fue 05/01 del año escolar actual, debe contar como moroso.
   - Para conceptos sin `due_month`, se mantendrá compatibilidad con el cálculo existente.

2. Cambiar la pantalla `/pagos/morosos` para consultar morosos desde una función RPC estable del backend, no desde lógica dependiente del navegador/PostgREST embeds.
   - Esto evita diferencias entre Lovable y VPS.
   - La consulta devolverá estudiantes con saldo mayor a 0 y conceptos vencidos después de la fecha de vencimiento del año escolar activo.
   - Seguirá mostrando grado, sección, conceptos pendientes y total adeudado.

3. Agregar un servicio de cron en `docker-compose.yml` para VPS.
   - Usará una imagen liviana de Postgres/Alpine.
   - Ejecutará todos los días a las 3:00 AM dentro del contenedor.
   - Llamará la función SQL de reconstrucción de balances para mantener morosidad actualizada aunque algún trigger o migración previa no haya corrido.
   - Montará un script nuevo desde `scripts/cron/`.

4. Ajustar la función `send-delinquency-reminders` para usar el mismo criterio de morosidad del backend.
   - Así los correos y la lista de morosos usarán exactamente la misma regla.
   - Evita que la función de recordatorios dependa de relaciones anidadas que en el VPS pueden fallar por caché/esquema.

5. Añadir comandos de despliegue/verificación para VPS.
   - `docker compose build --no-cache app`
   - `docker compose up -d supabase-migrations`
   - `docker compose up -d delinquency-cron supabase-functions app`
   - Verificación con `docker logs sat-delinquency-cron` y una consulta SQL para confirmar que el concepto vencido de enero aparece como moroso.

## Detalles técnicos

- No se usará `pg_cron` porque en este VPS el stack corre por Docker Compose y no hay ningún servicio cron configurado actualmente.
- El cron vivirá en Docker para que funcione igual en el servidor, sin depender del sistema operativo host.
- La función SQL será `SECURITY DEFINER`, con permisos revocados a usuarios públicos, y será invocada solo por el cron/migración con credenciales internas del contenedor.
- El cálculo central será en base a `school_years.is_active`, `payment_plan_concepts.due_month`, `payment_plan_concepts.due_day`, `student_payment_plans` y `student_concept_balances.balance > 0`.