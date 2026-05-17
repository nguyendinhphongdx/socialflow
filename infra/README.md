# Sociflow — Production Infra

Stack: docker compose + nginx + Let's Encrypt + Prometheus/Grafana + Postgres backup → R2.

References:
- [docs/decisions/0008-launch-readiness.md](../docs/decisions/0008-launch-readiness.md) — week-1 launch plan
- F-701 / F-702 / F-704 / F-705 in [docs/01-features.md](../docs/01-features.md)

## Layout

```
infra/
├── nginx/
│   ├── nginx.conf              # main config
│   ├── sociflow.conf           # vhosts (HTTPS, API, WS, Grafana, Web)
│   └── htpasswd.example        # basic-auth template for /grafana/
├── scripts/
│   ├── init-cert.sh            # one-shot Let's Encrypt provisioning
│   ├── certbot-renew.sh        # host-side renew cron (backup to in-stack certbot)
│   ├── backup-postgres.sh      # daily Postgres dump → R2
│   └── restore-postgres.sh     # restore from R2
└── monitoring/
    ├── prometheus.yml          # scrape config
    └── grafana/
        ├── datasources/prometheus.yml
        └── dashboards/
            ├── dashboard.yml             # provider config
            └── sociflow-overview.json    # default dashboard
```

Top-level files added:
- `docker-compose.prod.yml`
- `apps/api/Dockerfile.prod`, `apps/ai/Dockerfile.prod`, `apps/web/Dockerfile.prod`
- `.env.production.example`
- `.dockerignore`

## Initial deploy checklist

1. **DNS**: A record `sociflow.io` → host IP (and `cdn.sociflow.io` → R2 custom domain if used).
   Verify: `dig +short sociflow.io`.
2. **Firewall** (host): expose only 22, 80, 443. Block Postgres/Redis at the OS layer; docker-compose already keeps them on the internal network.
3. **Clone repo** under `/opt/sociflow`:
   ```bash
   git clone git@github.com:<org>/sociflow.git /opt/sociflow
   cd /opt/sociflow
   ```
4. **Env**:
   ```bash
   cp .env.production.example .env.production
   chmod 600 .env.production
   $EDITOR .env.production    # rotate secrets, fill OAuth, R2, SMTP, Sentry
   ```
   Generate secrets:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"   # JWT_*
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"   # ENCRYPTION_KEY
   openssl rand -hex 32                                                          # INTERNAL_TOKEN
   ```
5. **Grafana basic-auth** (protects `/grafana/` at the nginx edge):
   ```bash
   docker run --rm httpd:alpine htpasswd -nbB ops 'strong-password' > infra/nginx/htpasswd
   chmod 600 infra/nginx/htpasswd
   ```
6. **Cert provisioning** (must run before the rest of the stack hits 443):
   ```bash
   export DOMAIN=sociflow.io
   export LETSENCRYPT_EMAIL=admin@sociflow.io
   bash infra/scripts/init-cert.sh
   ```
   This swaps `DOMAIN_PLACEHOLDER` in `infra/nginx/sociflow.conf`, boots nginx with a temporary self-signed cert, runs `certbot certonly --webroot`, then reloads nginx.
7. **Build images**:
   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production build
   ```
8. **Migrate DB** (one-off the first time):
   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production run --rm api \
     node node_modules/.bin/prisma migrate deploy
   ```
9. **Start full stack**:
   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production up -d
   ```
10. **Verify**:
    ```bash
    curl -I https://sociflow.io/healthz                # 200
    curl -I https://sociflow.io/api/v1/health          # 200 from apps/api
    docker compose -f docker-compose.prod.yml ps
    docker compose -f docker-compose.prod.yml logs -f api ai web nginx
    ```

## Cron schedule (host crontab)

```cron
# Postgres backup → R2 (03:00 UTC daily)
0 3 * * *  cd /opt/sociflow && docker compose -f docker-compose.prod.yml --env-file .env.production run --rm backup /scripts/backup-postgres.sh >> /var/log/sociflow-backup.log 2>&1

# Cert renewal fallback (weekly Sunday 00:00 UTC) — in-stack certbot also runs every 12h
0 0 * * 0  /opt/sociflow/infra/scripts/certbot-renew.sh >> /var/log/sociflow-certbot.log 2>&1
```

Make scripts executable:
```bash
chmod +x infra/scripts/*.sh
```

## Backup restore

1. List backups in R2:
   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production run --rm backup \
     sh -c 'apk add --no-cache aws-cli >/dev/null && \
       AWS_ACCESS_KEY_ID=$R2_ACCESS_KEY AWS_SECRET_ACCESS_KEY=$R2_SECRET_KEY AWS_DEFAULT_REGION=auto \
       aws s3 ls s3://$R2_BACKUP_BUCKET/postgres/$PGDATABASE/ --endpoint-url $R2_ENDPOINT'
   ```
2. Restore (will DROP existing objects via `--clean --if-exists`):
   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production run --rm backup \
     /scripts/restore-postgres.sh postgres/sociflow/20260516T030000Z.dump
   ```
3. Run any pending migrations afterwards if the backup pre-dates them:
   ```bash
   docker compose -f docker-compose.prod.yml run --rm api node node_modules/.bin/prisma migrate deploy
   ```

## Observability

- **Prometheus** scrapes `api`, `ai`, `postgres-exporter`, `redis-exporter`, `nginx-exporter`.
  Retention 30d. Reachable internally at `prometheus:9090`.
- **Grafana** internal port 3000, exposed externally as `https://${DOMAIN}/grafana/` behind nginx basic auth. Default dashboard "Sociflow — Overview" auto-provisioned.
- **Datasource** auto-configured via `infra/monitoring/grafana/datasources/prometheus.yml`.
- **Sentry**: separate concern — Agent F2 wires SDK inside `apps/api`, `apps/ai`, `apps/web`. DSNs already templated in `.env.production.example`.

> ⚠️ `apps/api` and `apps/ai` currently do **not** export a `/metrics` endpoint. Until Agent F2 (or follow-up F-704 ticket) wires `prom-client` + `GET /metrics`, the `sociflow-api` / `sociflow-ai` scrape jobs will show `up=0`. Postgres/Redis/nginx exporters work day one.

## Troubleshooting

### Stuck migration (`P3009` failed migration)
```bash
docker compose -f docker-compose.prod.yml run --rm api \
  node node_modules/.bin/prisma migrate resolve --rolled-back <migration_name>
docker compose -f docker-compose.prod.yml run --rm api \
  node node_modules/.bin/prisma migrate deploy
```
If unsure which migration failed: `prisma migrate status`.

### Redis OOM (`OOM command not allowed when used memory > 'maxmemory'`)
- Config already sets `maxmemory 512mb` + `allkeys-lru` (will evict cache keys).
- BullMQ jobs are persisted via AOF; if queue keys are evicted, bump `maxmemory`:
  ```yaml
  command: [redis-server, --requirepass, $REDIS_PASSWORD, --maxmemory, 1gb, ...]
  ```
- Inspect: `docker exec -it sociflow-redis redis-cli -a $REDIS_PASSWORD INFO memory`.

### OAuth token rotation (`ENCRYPTION_KEY` change)
1. Rotate key in `.env.production`.
2. Run rotate CLI in api container:
   ```bash
   docker compose -f docker-compose.prod.yml run --rm api pnpm cli rotate-tokens
   ```
   (see `.claude/rules/cli-commands.md`).
3. Restart api + ai to pick up new key.

### Nginx returns 502 / upstream timeout
- `docker compose ps` — verify api/ai/web healthy.
- `docker compose logs api ai web` — check application errors.
- nginx reload after cert renew: `docker compose exec nginx nginx -s reload`.

### Cert renewal failed
- The in-stack `certbot` service loops `certbot renew` every 12h. Logs: `docker compose logs certbot`.
- Manual: `bash infra/scripts/certbot-renew.sh`.
- Verify chain: `echo | openssl s_client -servername $DOMAIN -connect $DOMAIN:443 2>/dev/null | openssl x509 -noout -dates`.

### Backup failed
- Check `/var/log/sociflow-backup.log`.
- Test creds: `aws s3 ls s3://$R2_BACKUP_BUCKET/ --endpoint-url $R2_ENDPOINT`.
- Dry-run dump only: `docker compose run --rm backup pg_dump -h postgres -U $POSTGRES_USER -d $POSTGRES_DB --schema-only`.

## Security notes

- Postgres + Redis: no published ports; only reachable via the `sociflow-prod` docker network.
- `/internal/*` paths are explicitly **403** at nginx (api ↔ ai talks via docker network using `INTERNAL_TOKEN`).
- Grafana behind nginx basic-auth **and** its own admin login.
- HSTS preload, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` set globally.
- Rate limits: 5 req/s auth, 30 req/s API per IP (nginx `limit_req`).
- Containers run as UID 1000 non-root (`sociflow` user inside `node:22-alpine`).
- Backup secrets (`R2_BACKUP_*`) should be a **separate** R2 token from app storage, scoped to the `sociflow-backups` bucket.

## What's NOT done in this infra layer

- Sentry SDK wiring (Agent F2 — `apps/api`, `apps/ai`, `apps/web`).
- Prometheus `/metrics` endpoint inside Nest apps (follow-up: add `prom-client` + a `MetricsController`).
- Alertmanager rules (Grafana alerting is left to a UI-driven follow-up).
- Multi-host / HA deploy (single-host docker compose — phase 1).
