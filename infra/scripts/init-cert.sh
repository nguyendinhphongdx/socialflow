#!/usr/bin/env bash
# =============================================================================
# Initial Let's Encrypt certificate provisioning.
# Run ONCE after DNS A records point to the host.
#
# Usage:
#   DOMAIN=sociflow.io LETSENCRYPT_EMAIL=admin@sociflow.io \
#     bash infra/scripts/init-cert.sh
#
# Prereqs:
#   - docker compose stack is *not* running on port 80 yet, OR nginx is up
#     serving /.well-known/acme-challenge from /var/www/certbot.
#   - DNS for $DOMAIN resolves to this host (verify: `dig +short $DOMAIN`).
# =============================================================================
set -euo pipefail

: "${DOMAIN:?must set DOMAIN env var}"
: "${LETSENCRYPT_EMAIL:?must set LETSENCRYPT_EMAIL env var}"

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
COMPOSE_FILE="${REPO_ROOT}/docker-compose.prod.yml"
ENV_FILE="${REPO_ROOT}/.env.production"

echo "[init-cert] Substituting domain ${DOMAIN} in nginx config..."
sed -i.bak "s/DOMAIN_PLACEHOLDER/${DOMAIN}/g" "${REPO_ROOT}/infra/nginx/sociflow.conf"

echo "[init-cert] Creating dummy self-signed cert so nginx can boot..."
docker run --rm \
  -v sociflow-prod_certbot_conf:/etc/letsencrypt \
  alpine sh -c "apk add --no-cache openssl >/dev/null && \
    mkdir -p /etc/letsencrypt/live/${DOMAIN} && \
    openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
      -keyout /etc/letsencrypt/live/${DOMAIN}/privkey.pem \
      -out /etc/letsencrypt/live/${DOMAIN}/fullchain.pem \
      -subj '/CN=localhost' && \
    cp /etc/letsencrypt/live/${DOMAIN}/fullchain.pem /etc/letsencrypt/live/${DOMAIN}/chain.pem"

echo "[init-cert] Starting nginx so it can serve /.well-known/acme-challenge ..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d nginx

echo "[init-cert] Removing dummy cert and requesting real one..."
docker run --rm \
  -v sociflow-prod_certbot_conf:/etc/letsencrypt \
  -v sociflow-prod_certbot_www:/var/www/certbot \
  certbot/certbot:latest \
  delete --non-interactive --cert-name "${DOMAIN}" || true

docker run --rm \
  -v sociflow-prod_certbot_conf:/etc/letsencrypt \
  -v sociflow-prod_certbot_www:/var/www/certbot \
  certbot/certbot:latest certonly \
    --webroot -w /var/www/certbot \
    --email "${LETSENCRYPT_EMAIL}" \
    --agree-tos --no-eff-email \
    --non-interactive \
    -d "${DOMAIN}"

echo "[init-cert] Reloading nginx..."
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" exec nginx nginx -s reload

echo "[init-cert] Done. Real cert installed for ${DOMAIN}."
echo "[init-cert] To verify: curl -I https://${DOMAIN}/healthz"
