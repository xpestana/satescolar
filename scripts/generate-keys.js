#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Genera JWT_SECRET, ANON_KEY y SERVICE_ROLE_KEY
// para desarrollo local con Supabase en Docker
//
// Uso:
//   node scripts/generate-keys.js          → usa .env en la raiz del proyecto
//   node scripts/generate-keys.js .env.staging
// ─────────────────────────────────────────────────────────────────────────────

import crypto from 'crypto';
import fs     from 'fs';
import path   from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── JWT helpers ─────────────────────────────────────────────────────────────

function base64url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function createJWT(payload, secret) {
  const header    = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body      = base64url(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

// ─── Key generation ───────────────────────────────────────────────────────────

const jwtSecret = crypto.randomBytes(32).toString('base64');

const now = Math.floor(Date.now() / 1000);
const exp = now + 10 * 365 * 24 * 60 * 60; // 10 años

const anonKey = createJWT(
  { role: 'anon', iss: 'supabase', iat: now, exp },
  jwtSecret
);

const serviceRoleKey = createJWT(
  { role: 'service_role', iss: 'supabase', iat: now, exp },
  jwtSecret
);

console.log('\nClaves generadas correctamente:\n');
console.log(`JWT_SECRET=${jwtSecret}`);
console.log(`ANON_KEY=${anonKey}`);
console.log(`SERVICE_ROLE_KEY=${serviceRoleKey}`);
console.log('');

// ─── Update .env ──────────────────────────────────────────────────────────────

// Resuelve relativo a la raiz del proyecto (un nivel arriba de /scripts)
const projectRoot = path.resolve(__dirname, '..');
const envFile     = path.resolve(projectRoot, process.argv[2] || '.env');

if (!fs.existsSync(envFile)) {
  console.warn(`Advertencia: no se encontro ${envFile}.`);
  console.warn('Copia .env.example a .env y ejecuta de nuevo.');
  process.exit(0);
}

const replacements = {
  JWT_SECRET:                    jwtSecret,
  ANON_KEY:                      anonKey,
  SERVICE_ROLE_KEY:              serviceRoleKey,
  VITE_SUPABASE_PUBLISHABLE_KEY: anonKey,
};

let content = fs.readFileSync(envFile, 'utf8');

for (const [key, value] of Object.entries(replacements)) {
  const regex = new RegExp(`^(${key}=).*`, 'm');
  if (regex.test(content)) {
    content = content.replace(regex, `$1${value}`);
  }
}

fs.writeFileSync(envFile, content, 'utf8');
console.log(`Archivo ${envFile} actualizado con las nuevas claves.`);
