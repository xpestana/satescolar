#!/bin/sh
# Cron diario para reconstruir saldos de morosidad.
# Se ejecuta dentro de un contenedor Alpine con cron.
set -e

LOG_FILE="/var/log/delinquency-cron.log"
mkdir -p /var/log
touch "$LOG_FILE"

# Escribir el cronfile cada arranque (idempotente).
# 03:00 todos los días: reconstruye balances faltantes.
cat > /etc/crontabs/root <<EOF
0 3 * * * /usr/local/bin/run-delinquency-job.sh >> $LOG_FILE 2>&1
EOF

cat > /usr/local/bin/run-delinquency-job.sh <<'EOS'
#!/bin/sh
set -e
echo "[$(date -Iseconds)] === Delinquency rebuild start ==="
PGPASSWORD="$POSTGRES_PASSWORD" psql \
  -h "$POSTGRES_HOST" \
  -U "${POSTGRES_USER:-supabase_admin}" \
  -d "${POSTGRES_DB:-postgres}" \
  -v ON_ERROR_STOP=1 \
  -c "SELECT public.rebuild_student_concept_balances_for_active_year() AS inserted;"
echo "[$(date -Iseconds)] === Delinquency rebuild done ==="
EOS
chmod +x /usr/local/bin/run-delinquency-job.sh

# Ejecutar una vez al arrancar para que no haya que esperar al primer cron tick.
echo "[$(date -Iseconds)] Running initial rebuild on container start..."
/usr/local/bin/run-delinquency-job.sh >> "$LOG_FILE" 2>&1 || \
  echo "[$(date -Iseconds)] WARN: initial rebuild failed (db quizá aún no listo)" >> "$LOG_FILE"

echo "[$(date -Iseconds)] Starting crond (foreground)..."
# -f foreground, -l 8 nivel de log, -L stdout
exec crond -f -l 8 -L /dev/stdout
