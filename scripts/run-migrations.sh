#!/bin/sh
# Solo LF (Unix). CRLF rompe líneas al ejecutar con sh en contenedores Linux.
set -e
POSTGRES_USER="${POSTGRES_USER:-supabase_admin}"
echo "==> Iniciando runner de migraciones..."

psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -c \
  "CREATE TABLE IF NOT EXISTS public._docker_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());"

EARLY_DIR="/seeds/early"
EARLY_APPLIED=0

apply_early_seeds() {
  if [ -d "$EARLY_DIR" ] && [ "$EARLY_APPLIED" -eq 0 ]; then
    for seed in "$EARLY_DIR"/*.sql; do
      [ -f "$seed" ] || continue
      sb=$(basename "$seed")
      echo "  🌱 early seed: $sb"
      psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f "$seed"
    done
    EARLY_APPLIED=1
  fi
}

set -- /migrations/*.sql
if [ ! -f "$1" ]; then
  echo "==> No hay .sql en /migrations/; nada que aplicar."
  apply_early_seeds
  exit 0
fi
for f in /migrations/*.sql; do
  [ -f "$f" ] || continue
  b=$(basename "$f")
  applied=$(psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -c "SELECT 1 FROM public._docker_migrations WHERE filename = '$b' LIMIT 1;" 2>/dev/null || true)
  if [ "$applied" = "1" ]; then
    echo "  Omitiendo (ya aplicada): $b"
    apply_early_seeds
    continue
  fi
  echo "  Aplicando: $b"
  psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f "$f"
  psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -c "INSERT INTO public._docker_migrations (filename) VALUES ('$b');"
  # Tras la primera migración (que crea public.schools), aplicar early seeds
  # para que migraciones posteriores con FK a schools no fallen.
  apply_early_seeds
done

# PostgREST mantiene caché de esquema; sin esto, tablas nuevas no aparecen hasta reiniciar el servicio
psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "NOTIFY pgrst, 'reload schema';" 2>/dev/null || true

# ──────────────────────────────────────────────────────────────────────────────
# Verificación post-migración: relaciones críticas que PostgREST debe poder
# resolver para los embeds del frontend. Si alguna falta, abortamos para que
# el despliegue no quede "verde" con el cache de PostgREST roto.
# ──────────────────────────────────────────────────────────────────────────────
echo "==> Verificando relaciones críticas del módulo de pagos..."
REQUIRED_FKS="
public.payment_plan_concepts:plan_id:public.payment_plans:id
public.payment_plan_concepts:concept_id:public.payment_concepts:id
public.student_payment_plans:plan_id:public.payment_plans:id
public.student_payment_plans:student_id:public.students:id
public.student_payment_plans:school_id:public.schools:id
public.student_payment_plans:school_year_id:public.school_years:id
public.student_concept_balances:plan_concept_id:public.payment_plan_concepts:id
public.student_concept_balances:student_id:public.students:id
public.student_concept_balances:school_id:public.schools:id
public.student_concept_balances:school_year_id:public.school_years:id
public.payments:school_id:public.schools:id
public.payments:school_year_id:public.school_years:id
public.payments:student_id:public.students:id
public.payment_items:payment_id:public.payments:id
public.payment_items:plan_concept_id:public.payment_plan_concepts:id
public.payment_method_entries:payment_id:public.payments:id
"
MISSING=0
for spec in $REQUIRED_FKS; do
  [ -z "$spec" ] && continue
  TBL=$(echo "$spec" | cut -d: -f1)
  COL=$(echo "$spec" | cut -d: -f2)
  RTBL=$(echo "$spec" | cut -d: -f3)
  RCOL=$(echo "$spec" | cut -d: -f4)
  found=$(psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -c "
    SELECT 1 FROM pg_constraint c
    JOIN pg_attribute a  ON a.attrelid  = c.conrelid  AND a.attnum  = c.conkey[1]
    JOIN pg_attribute ra ON ra.attrelid = c.confrelid AND ra.attnum = c.confkey[1]
    WHERE c.contype='f'
      AND c.conrelid='${TBL}'::regclass
      AND c.confrelid='${RTBL}'::regclass
      AND a.attname='${COL}' AND ra.attname='${RCOL}'
    LIMIT 1;" 2>/dev/null || true)
  if [ "$found" != "1" ]; then
    echo "  ❌ FALTA FK: ${TBL}(${COL}) -> ${RTBL}(${RCOL})"
    MISSING=$((MISSING+1))
  fi
done
if [ "$MISSING" -gt 0 ]; then
  echo "==> ERROR: faltan $MISSING relaciones críticas. Aborta el despliegue."
  exit 2
fi
echo "==> Relaciones críticas verificadas."

echo "==> Migraciones completadas."
