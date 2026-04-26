#!/bin/sh
# Ejecutar DESPUÉS de migrate.sh de supabase/postgres (orden lexicográfico: zz-... al final).
# Asigna POSTGRES_PASSWORD a authenticator, supabase_auth_admin, supabase_storage_admin.
# Solo LF (Unix). Ejecutable: git update-index --chmod=+x scripts/zz-set-role-passwords.sh

set -eu

sql_escape() {
  printf '%s' "$1" | sed "s/'/''/g"
}

PW=$(sql_escape "${POSTGRES_PASSWORD}")

psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" <<-EOSQL
  ALTER ROLE authenticator WITH PASSWORD '${PW}';
  ALTER ROLE supabase_auth_admin WITH PASSWORD '${PW}';
  ALTER ROLE supabase_storage_admin WITH PASSWORD '${PW}';
EOSQL
