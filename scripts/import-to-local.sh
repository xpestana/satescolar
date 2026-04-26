#!/usr/bin/env bash
# ─────────────────────────────────────────────────
# Aplica las migraciones de supabase/migrations/
# al PostgreSQL local (Docker)
# ─────────────────────────────────────────────────
set -euo pipefail

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-postgres}"
DB_USER="postgres"
DB_PASS="${POSTGRES_PASSWORD:-}"

MIGRATIONS_DIR="./supabase/migrations"
DUMP_DIR="./scripts/dumps"

export PGPASSWORD="$DB_PASS"

echo "📦 Aplicando migraciones al PostgreSQL local..."
echo "   Host: ${DB_HOST}:${DB_PORT}"
echo ""

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "❌ No se encontró el directorio ${MIGRATIONS_DIR}"
  exit 1
fi

SEED_DIR="./scripts/seeds"
SEED_APPLIED=0

apply_seeds() {
  if [ -d "$SEED_DIR" ] && [ "$SEED_APPLIED" -eq 0 ]; then
    for seed in $(ls "$SEED_DIR"/*.sql 2>/dev/null | sort); do
      seed_name=$(basename "$seed")
      echo "  🌱 seed: ${seed_name}"
      psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$seed" --quiet --no-psqlrc 2>&1 | grep -v "^$" || true
    done
    SEED_APPLIED=1
  fi
}

MIGRATION_COUNT=0
for migration in $(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort); do
  filename=$(basename "$migration")
  echo "  ▶ ${filename}"
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$migration" --quiet --no-psqlrc 2>&1 | grep -v "^$" || true
  MIGRATION_COUNT=$((MIGRATION_COUNT + 1))
  # Después de la primera migración (que crea public.schools), aplicar
  # los seeds de ./scripts/seeds/ para garantizar que filas referenciadas
  # por migraciones posteriores existan antes de tiempo.
  apply_seeds
done

# Por si no había ninguna migración, aplicar seeds igualmente.
apply_seeds

echo ""
echo "✅ ${MIGRATION_COUNT} migraciones aplicadas."

# Si hay un dump de datos, importarlo
if [ -f "${DUMP_DIR}/data.sql" ]; then
  echo ""
  echo "📥 Importando datos desde ${DUMP_DIR}/data.sql..."
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "${DUMP_DIR}/data.sql" --quiet --no-psqlrc 2>&1 | grep -v "^$" || true
  echo "✅ Datos importados."
fi
