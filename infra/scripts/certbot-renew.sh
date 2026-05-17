#!/usr/bin/env bash
# =============================================================================
# Certbot renew helper. Cron-friendly.
#
# Cron entry (host crontab):
#   0 0 * * 0  /opt/sociflow/infra/scripts/certbot-renew.sh >> /var/log/sociflow-certbot.log 2>&1
#
# Note: the in-stack `certbot` service already runs `certbot renew` every 12h.
# This script is a belt-and-braces fallback if you prefer host-side cron.
# =============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
COMPOSE_FILE="${REPO_ROOT}/docker-compose.prod.yml"
ENV_FILE="${REPO_ROOT}/.env.production"

echo "[$(date -u +%FT%TZ)] [certbot-renew] starting"

docker run --rm \
  -v sociflow-prod_certbot_conf:/etc/letsencrypt \
  -v sociflow-prod_certbot_www:/var/www/certbot \
  certbot/certbot:latest renew --webroot -w /var/www/certbot --quiet

echo "[$(date -u +%FT%TZ)] [certbot-renew] reloading nginx"
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" exec -T nginx nginx -s reload

echo "[$(date -u +%FT%TZ)] [certbot-renew] done"
