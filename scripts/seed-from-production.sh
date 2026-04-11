#!/usr/bin/env bash
# ─────────────────────────────────────────────────
# Script todo-en-uno: exporta de producción e importa
# al contenedor Docker local
# ─────────────────────────────────────────────────
set -euo pipefail

# Cargar variables de .env si existe
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

echo "🔄 Seed desde producción"
echo "========================"
echo ""

# 1. Exportar esquema
echo "📤 Paso 1: Exportar esquema..."
bash scripts/export-schema.sh

# 2. Exportar datos de referencia
echo ""
echo "📤 Paso 2: Exportar datos de referencia..."
bash scripts/export-data.sh

# 3. Importar al contenedor local
echo ""
echo "📥 Paso 3: Importar al PostgreSQL local..."
export DB_HOST=localhost
bash scripts/import-to-local.sh

echo ""
echo "🎉 ¡Seed completado! Tu BD local tiene el esquema y datos de producción."
