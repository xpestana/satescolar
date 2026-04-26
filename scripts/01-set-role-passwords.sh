#!/usr/bin/env bash
# Asigna la misma contraseña que POSTGRES_PASSWORD a los roles que usan los servicios Supabase.
# Debe ser ejecutable en el contenedor (git: git update-index --chmod=+x scripts/01-set-role-passwords.sh).

set -euo pipefail

# Escapar comillas simples en la contraseña para SQL ('' dentro de un literal SQL)
sql_escape() {
  printf '%s' "$1" | sed "s/'/''/g"
}

PW=$(sql_escape "${POSTGRES_PASSWORD}")

psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" <<-EOSQL
  ALTER ROLE authenticator WITH PASSWORD '${PW}';
  ALTER ROLE supabase_auth_admin WITH PASSWORD '${PW}';
  ALTER ROLE supabase_storage_admin WITH PASSWORD '${PW}';
EOSQL
