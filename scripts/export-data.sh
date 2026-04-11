#!/usr/bin/env bash
# ─────────────────────────────────────────────────
# Exporta datos de tablas seleccionadas de producción
# Uso: bash scripts/export-data.sh [tabla1 tabla2 ...]
# Sin argumentos exporta tablas de referencia
# ─────────────────────────────────────────────────
set -euo pipefail

DUMP_DIR="./scripts/dumps"
mkdir -p "$DUMP_DIR"

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "❌ Variable SUPABASE_DB_URL no configurada."
  echo "   Configúrala en .env con la URL de conexión de tu BD de producción."
  exit 1
fi

# Tablas por defecto (datos de referencia)
DEFAULT_TABLES=(
  states
  municipalities
  cities
  parishes
)

TABLES=("${@:-${DEFAULT_TABLES[@]}}")

echo "📤 Exportando datos de producción..."
echo "   Tablas: ${TABLES[*]}"
echo ""

TABLE_ARGS=""
for table in "${TABLES[@]}"; do
  TABLE_ARGS="${TABLE_ARGS} --table=public.${table}"
done

pg_dump "$SUPABASE_DB_URL" \
  --data-only \
  --no-owner \
  --no-privileges \
  --schema=public \
  ${TABLE_ARGS} \
  --file="${DUMP_DIR}/data.sql"

echo "✅ Datos exportados en ${DUMP_DIR}/data.sql"
