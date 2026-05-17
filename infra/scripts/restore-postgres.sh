#!/usr/bin/env sh
# =============================================================================
# Restore Postgres from a backup stored in R2.
# Usage (inside `backup` container):
#   docker compose -f docker-compose.prod.yml --env-file .env.production \
#     run --rm backup /scripts/restore-postgres.sh <OBJECT_KEY>
#
# Example OBJECT_KEY: postgres/sociflow/20260516T030000Z.dump
# Get list: aws s3 ls s3://$R2_BACKUP_BUCKET/postgres/$PGDATABASE/ --endpoint-url $R2_ENDPOINT
# =============================================================================
set -eu

OBJECT_KEY="${1:-}"
: "${OBJECT_KEY:?usage: $0 <object_key>}"
: "${PGHOST:?missing}"
: "${PGUSER:?missing}"
: "${PGPASSWORD:?missing}"
: "${PGDATABASE:?missing}"
: "${R2_BACKUP_BUCKET:?missing}"
: "${R2_ACCESS_KEY:?missing}"
: "${R2_SECRET_KEY:?missing}"
: "${R2_ENDPOINT:?missing}"

LOCAL_FILE="/tmp/restore-$(basename "${OBJECT_KEY}")"

log() { echo "[$(date -u +%FT%TZ)] [restore-postgres] $*"; }

if ! command -v aws >/dev/null 2>&1; then
  apk add --no-cache aws-cli >/dev/null
fi

export AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY}"
export AWS_SECRET_ACCESS_KEY="${R2_SECRET_KEY}"
export AWS_DEFAULT_REGION=auto
export AWS_EC2_METADATA_DISABLED=true

log "downloading s3://${R2_BACKUP_BUCKET}/${OBJECT_KEY}"
aws s3 cp "s3://${R2_BACKUP_BUCKET}/${OBJECT_KEY}" "${LOCAL_FILE}" \
  --endpoint-url "${R2_ENDPOINT}" --no-progress

log "restoring with pg_restore (will DROP existing objects!)"
PGPASSWORD="${PGPASSWORD}" pg_restore \
  --host="${PGHOST}" \
  --username="${PGUSER}" \
  --dbname="${PGDATABASE}" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --verbose \
  "${LOCAL_FILE}"

log "restore complete"
rm -f "${LOCAL_FILE}"
