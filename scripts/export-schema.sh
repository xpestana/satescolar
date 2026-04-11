#!/usr/bin/env bash
# ─────────────────────────────────────────────────
# Exporta el esquema completo de la BD de producción
# (tablas, funciones, triggers, RLS policies)
# ─────────────────────────────────────────────────
set -euo pipefail

DUMP_DIR="./scripts/dumps"
mkdir -p "$DUMP_DIR"

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "❌ Variable SUPABASE_DB_URL no configurada."
  echo "   Configúrala en .env con la URL de conexión de tu BD de producción."
  echo "   Formato: postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres"
  exit 1
fi

echo "📤 Exportando esquema de producción..."
pg_dump "$SUPABASE_DB_URL" \
  --schema-only \
  --no-owner \
  --no-privileges \
  --schema=public \
  --file="${DUMP_DIR}/schema.sql"

echo "✅ Esquema exportado en ${DUMP_DIR}/schema.sql"
