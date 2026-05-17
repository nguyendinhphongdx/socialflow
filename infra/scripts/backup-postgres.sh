#!/usr/bin/env sh
# =============================================================================
# Postgres → Cloudflare R2 daily backup.
#
# Designed to run INSIDE the `backup` service container (postgres:16-alpine +
# AWS CLI installed at runtime). Host-side cron invokes:
#
#   0 3 * * *  cd /opt/sociflow && \
#     docker compose -f docker-compose.prod.yml --env-file .env.production \
#       run --rm backup /scripts/backup-postgres.sh \
#       >> /var/log/sociflow-backup.log 2>&1
#
# Env vars required (sourced from .env.production):
#   PGHOST, PGUSER, PGPASSWORD, PGDATABASE
#   R2_BACKUP_BUCKET, R2_ACCESS_KEY, R2_SECRET_KEY, R2_ENDPOINT
#   BACKUP_RETENTION_DAYS (optional, default 30)
# =============================================================================
set -eu

: "${PGHOST:?missing}"
: "${PGUSER:?missing}"
: "${PGPASSWORD:?missing}"
: "${PGDATABASE:?missing}"
: "${R2_BACKUP_BUCKET:?missing}"
: "${R2_ACCESS_KEY:?missing}"
: "${R2_SECRET_KEY:?missing}"
: "${R2_ENDPOINT:?missing}"

RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
HOSTNAME_LABEL="$(hostname || echo unknown)"
DUMP_FILE="/tmp/${PGDATABASE}-${TIMESTAMP}.dump"
OBJECT_KEY="postgres/${PGDATABASE}/${TIMESTAMP}.dump"

log() { echo "[$(date -u +%FT%TZ)] [backup-postgres] $*"; }

# Install AWS CLI if not present (postgres:16-alpine has neither aws nor pip-without-network)
if ! command -v aws >/dev/null 2>&1; then
  log "installing aws-cli (alpine apk)..."
  apk add --no-cache aws-cli >/dev/null
fi

log "starting pg_dump host=${PGHOST} db=${PGDATABASE}"
PGPASSWORD="${PGPASSWORD}" pg_dump \
  --host="${PGHOST}" \
  --username="${PGUSER}" \
  --dbname="${PGDATABASE}" \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-privileges \
  --file="${DUMP_FILE}"

DUMP_SIZE="$(stat -c %s "${DUMP_FILE}" 2>/dev/null || wc -c < "${DUMP_FILE}")"
log "dump complete size=${DUMP_SIZE} bytes"

export AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY}"
export AWS_SECRET_ACCESS_KEY="${R2_SECRET_KEY}"
export AWS_DEFAULT_REGION=auto
export AWS_EC2_METADATA_DISABLED=true

log "uploading to s3://${R2_BACKUP_BUCKET}/${OBJECT_KEY}"
aws s3 cp "${DUMP_FILE}" "s3://${R2_BACKUP_BUCKET}/${OBJECT_KEY}" \
  --endpoint-url "${R2_ENDPOINT}" \
  --no-progress \
  --metadata "host=${HOSTNAME_LABEL},db=${PGDATABASE}"

log "upload ok"
rm -f "${DUMP_FILE}"

# -----------------------------------------------------------------------------
# Retention: prune objects older than $RETENTION_DAYS days.
# R2 supports S3 list/delete; we compute a UTC cutoff in seconds.
# -----------------------------------------------------------------------------
log "pruning objects older than ${RETENTION_DAYS} days"
CUTOFF_EPOCH=$(( $(date -u +%s) - RETENTION_DAYS * 86400 ))

aws s3api list-objects-v2 \
  --endpoint-url "${R2_ENDPOINT}" \
  --bucket "${R2_BACKUP_BUCKET}" \
  --prefix "postgres/${PGDATABASE}/" \
  --query 'Contents[].[Key,LastModified]' \
  --output text 2>/dev/null | while read -r KEY LAST_MODIFIED; do
    [ -z "${KEY}" ] && continue
    OBJECT_EPOCH=$(date -u -d "${LAST_MODIFIED}" +%s 2>/dev/null || echo 0)
    if [ "${OBJECT_EPOCH}" -gt 0 ] && [ "${OBJECT_EPOCH}" -lt "${CUTOFF_EPOCH}" ]; then
      log "deleting old backup ${KEY} (mtime=${LAST_MODIFIED})"
      aws s3 rm "s3://${R2_BACKUP_BUCKET}/${KEY}" --endpoint-url "${R2_ENDPOINT}"
    fi
  done

log "done"
