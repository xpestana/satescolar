#!/bin/bash
# ============================================================
# SAT Escolar — Script de Migraciones
# ============================================================
# Uso: ./scripts/migrate.sh
#
# Qué hace:
#   1. Instala el CLI de Supabase si no está disponible
#   2. Se autentica con el token del .env
#   3. Linka el proyecto cloud
#   4. Aplica las migraciones pendientes a Supabase Cloud
#
# Para crear una nueva migración antes de correr este script:
#   Crea el archivo en supabase/migrations/YYYYMMDDHHMMSS_nombre.sql
# ============================================================

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$PROJECT_DIR/.env"

# ── Cargar variables del .env ─────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ No se encontró .env en $PROJECT_DIR"
  exit 1
fi

export $(grep -v '^#' "$ENV_FILE" | grep -v '^$' | xargs)

# ── Validar variables requeridas ──────────────────────────
if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
  echo "❌ Falta SUPABASE_ACCESS_TOKEN en .env"
  echo "   Agrégalo así: SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxxxxxx"
  echo "   Obtenlo en: supabase.com/dashboard → Account → Access Tokens"
  exit 1
fi

if [ -z "$VITE_SUPABASE_PROJECT_ID" ]; then
  echo "❌ Falta VITE_SUPABASE_PROJECT_ID en .env"
  exit 1
fi

if [ -z "$SUPABASE_DB_PASSWORD" ]; then
  echo "❌ Falta SUPABASE_DB_PASSWORD en .env"
  exit 1
fi

PROJECT_REF="$VITE_SUPABASE_PROJECT_ID"

# ── Instalar CLI de Supabase si no está ───────────────────
SUPABASE_BIN="/tmp/supabase"
if [ ! -f "$SUPABASE_BIN" ]; then
  echo "📦 Instalando Supabase CLI..."
  curl -sL https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz \
    | tar -xz -C /tmp supabase
  chmod +x "$SUPABASE_BIN"
  echo "✅ CLI instalado: $($SUPABASE_BIN --version)"
else
  echo "✅ CLI disponible: $($SUPABASE_BIN --version)"
fi

# ── Autenticar y linkear proyecto ────────────────────────
echo ""
echo "🔗 Autenticando con Supabase..."
$SUPABASE_BIN login --token "$SUPABASE_ACCESS_TOKEN"

echo "🔗 Linkeando proyecto $PROJECT_REF..."
cd "$PROJECT_DIR"
$SUPABASE_BIN link --project-ref "$PROJECT_REF" --password "$SUPABASE_DB_PASSWORD"

# ── Ver estado de migraciones ────────────────────────────
echo ""
echo "📋 Estado de migraciones:"
$SUPABASE_BIN migration list

# ── Aplicar migraciones pendientes ───────────────────────
echo ""
echo "🚀 Aplicando migraciones pendientes..."
$SUPABASE_BIN db push --password "$SUPABASE_DB_PASSWORD"

echo ""
echo "✅ Migraciones completadas."
