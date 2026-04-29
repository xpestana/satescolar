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

EARLY_DIR="./scripts/seeds/early"
EARLY_APPLIED=0

apply_early_seeds() {
  if [ -d "$EARLY_DIR" ] && [ "$EARLY_APPLIED" -eq 0 ]; then
    for seed in $(ls "$EARLY_DIR"/*.sql 2>/dev/null | sort); do
      seed_name=$(basename "$seed")
      echo "  🌱 early seed: ${seed_name}"
      psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$seed" --quiet --no-psqlrc 2>&1 | grep -v "^$" || true
    done
    EARLY_APPLIED=1
  fi
}

MIGRATION_COUNT=0
for migration in $(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort); do
  filename=$(basename "$migration")
  echo "  ▶ ${filename}"
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$migration" --quiet --no-psqlrc 2>&1 | grep -v "^$" || true
  MIGRATION_COUNT=$((MIGRATION_COUNT + 1))
  apply_early_seeds
done

apply_early_seeds
apply_late_seeds

echo ""
echo "✅ ${MIGRATION_COUNT} migraciones aplicadas."

# Si hay un dump de datos, importarlo
if [ -f "${DUMP_DIR}/data.sql" ]; then
  echo ""
  echo "📥 Importando datos desde ${DUMP_DIR}/data.sql..."
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "${DUMP_DIR}/data.sql" --quiet --no-psqlrc 2>&1 | grep -v "^$" || true
  echo "✅ Datos importados."
fi
