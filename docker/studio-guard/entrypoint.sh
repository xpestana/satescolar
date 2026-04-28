#!/bin/sh
set -eu
if [ -z "${STUDIO_AUTH_USER:-}" ] || [ -z "${STUDIO_AUTH_PASSWORD:-}" ]; then
  echo "studio-guard: define STUDIO_AUTH_USER y STUDIO_AUTH_PASSWORD en .env" >&2
  exit 1
fi
htpasswd -bc /etc/nginx/.htpasswd "${STUDIO_AUTH_USER}" "${STUDIO_AUTH_PASSWORD}" >/dev/null
exec nginx -g "daemon off;"
