#!/usr/bin/env bash
# ─────────────────────────────────────────────────
# Genera JWT_SECRET, ANON_KEY y SERVICE_ROLE_KEY
# para desarrollo local con Supabase en Docker
# ─────────────────────────────────────────────────
set -euo pipefail

ENV_FILE="${1:-.env}"

# Generar JWT_SECRET aleatorio
JWT_SECRET=$(openssl rand -base64 32)

echo "🔑 Generando claves JWT..."

# Generar ANON_KEY y SERVICE_ROLE_KEY usando Node.js
read -r ANON_KEY SERVICE_ROLE_KEY <<< $(node -e "
const crypto = require('crypto');

function createJWT(payload, secret) {
  const header = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(header+'.'+body).digest('base64url');
  return header+'.'+body+'.'+signature;
}

const now = Math.floor(Date.now()/1000);
const exp = now + (10 * 365 * 24 * 60 * 60); // 10 años

const anon = createJWT({
  role: 'anon',
  iss: 'supabase',
  iat: now,
  exp: exp
}, '${JWT_SECRET}');

const service = createJWT({
  role: 'service_role',
  iss: 'supabase',
  iat: now,
  exp: exp
}, '${JWT_SECRET}');

process.stdout.write(anon + ' ' + service);
")

echo ""
echo "✅ Claves generadas correctamente:"
echo ""
echo "JWT_SECRET=${JWT_SECRET}"
echo "ANON_KEY=${ANON_KEY}"
echo "SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}"
echo ""

# Si existe .env, actualizar las claves
if [ -f "$ENV_FILE" ]; then
  sed -i.bak "s|^JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|" "$ENV_FILE"
  sed -i.bak "s|^ANON_KEY=.*|ANON_KEY=${ANON_KEY}|" "$ENV_FILE"
  sed -i.bak "s|^SERVICE_ROLE_KEY=.*|SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}|" "$ENV_FILE"
  sed -i.bak "s|^VITE_SUPABASE_PUBLISHABLE_KEY=.*|VITE_SUPABASE_PUBLISHABLE_KEY=${ANON_KEY}|" "$ENV_FILE"
  rm -f "${ENV_FILE}.bak"
  echo "📝 Archivo ${ENV_FILE} actualizado con las nuevas claves."
else
  echo "⚠️  No se encontró ${ENV_FILE}. Copia .env.example a .env y ejecuta de nuevo."
fi
