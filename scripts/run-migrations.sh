#!/bin/sh
# Solo LF (Unix). CRLF rompe líneas al ejecutar con sh en contenedores Linux.
set -e
POSTGRES_USER="${POSTGRES_USER:-supabase_admin}"
echo "==> Iniciando runner de migraciones..."

psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -c \
  "CREATE TABLE IF NOT EXISTS public._docker_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());"

SEED_DIR="/seeds"
SEED_APPLIED=0

apply_seeds() {
  if [ -d "$SEED_DIR" ] && [ "$SEED_APPLIED" -eq 0 ]; then
    for seed in "$SEED_DIR"/*.sql; do
      [ -f "$seed" ] || continue
      sb=$(basename "$seed")
      echo "  🌱 seed: $sb"
      psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f "$seed"
    done
    SEED_APPLIED=1
  fi
}

set -- /migrations/*.sql
if [ ! -f "$1" ]; then
  echo "==> No hay .sql en /migrations/; nada que aplicar."
  apply_seeds
  exit 0
fi
for f in /migrations/*.sql; do
  [ -f "$f" ] || continue
  b=$(basename "$f")
  applied=$(psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -c "SELECT 1 FROM public._docker_migrations WHERE filename = '$b' LIMIT 1;" 2>/dev/null || true)
  if [ "$applied" = "1" ]; then
    echo "  Omitiendo (ya aplicada): $b"
    apply_seeds
    continue
  fi
  echo "  Aplicando: $b"
  psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f "$f"
  psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -c "INSERT INTO public._docker_migrations (filename) VALUES ('$b');"
  # Tras la primera migración (que crea public.schools), aplicar los seeds
  # para que migraciones posteriores con FK a schools no fallen.
  apply_seeds
done

# PostgREST mantiene caché de esquema; sin esto, tablas nuevas no aparecen hasta reiniciar el servicio
psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "NOTIFY pgrst, 'reload schema';" 2>/dev/null || true

echo "==> Migraciones completadas."
