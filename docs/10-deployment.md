---
title: Deployment
description: Local dev, staging, production deploy, monitoring
audience: [developer, devops]
---

# Deployment

## Local development

### Yêu cầu

- Docker Desktop / Docker Engine
- Node 22.x
- pnpm 10.x

### One-time setup

```bash
git clone <repo>
cd sociflow
pnpm install

# Copy env files
cp apps/api/.env.example apps/api/.env
cp apps/ai/.env.example apps/ai/.env
cp apps/web/.env.example apps/web/.env

# Khởi tạo Postgres + Redis + MinIO
docker compose -f docker-compose.dev.yml up -d

# Chạy migration
pnpm prisma migrate dev

# Seed data (optional)
pnpm prisma db seed
```

### Chạy dev

```bash
# Chạy tất cả services song song
pnpm dev

# Hoặc từng cái
pnpm --filter @sociflow/api dev
pnpm --filter @sociflow/ai dev
pnpm --filter @sociflow/web dev
pnpm --filter @sociflow/extension dev
```

Ports mặc định:

| Service | Port |
|---|---|
| api | 3000 |
| ai | 3001 |
| web | 3010 |
| postgres | 5432 |
| redis | 6379 |
| minio | 9000 (S3) / 9001 (console) |

## docker-compose.dev.yml (local infra)

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: sociflow
      POSTGRES_PASSWORD: dev
      POSTGRES_DB: sociflow_dev
    ports: ["5432:5432"]
    volumes:
      - pg-data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes:
      - redis-data:/data

  minio:
    image: minio/minio:latest
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    command: server /data --console-address ":9001"
    ports: ["9000:9000", "9001:9001"]
    volumes:
      - minio-data:/data

  minio-init:
    image: minio/mc:latest
    depends_on: [minio]
    entrypoint: >
      /bin/sh -c "
      until mc alias set local http://minio:9000 minioadmin minioadmin; do sleep 1; done;
      mc mb -p local/sociflow-media;
      mc anonymous set download local/sociflow-media;
      "

volumes:
  pg-data:
  redis-data:
  minio-data:
```

## Production deployment

### Topology

```
                      ┌────────────────────┐
                      │  Cloudflare        │
                      │  DNS + DDoS + CDN  │
                      │  (R2 bucket)       │
                      └─────────┬──────────┘
                                ▼
                      ┌────────────────────┐
                      │  Hetzner VPS       │
                      │  CPX31 (4vCPU,8GB) │
                      │  €15/month         │
                      │                    │
                      │  Docker:           │
                      │  - nginx           │
                      │  - api (×2)        │
                      │  - ai (×1)         │
                      │  - web (×2)        │
                      │  - postgres        │
                      │  - redis           │
                      │  - loki+grafana    │
                      └────────────────────┘
```

### docker-compose.prod.yml (rút gọn)

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - pg-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "${POSTGRES_USER}"]
      interval: 10s

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis-data:/data

  api:
    image: ghcr.io/${OWNER}/sociflow-api:${TAG:-latest}
    restart: unless-stopped
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_started }
    env_file: .env.prod
    deploy:
      replicas: 2
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/health',r=>process.exit(r.statusCode===200?0:1))"]

  ai:
    image: ghcr.io/${OWNER}/sociflow-ai:${TAG:-latest}
    restart: unless-stopped
    env_file: .env.prod
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3001/health',r=>process.exit(r.statusCode===200?0:1))"]

  web:
    image: ghcr.io/${OWNER}/sociflow-web:${TAG:-latest}
    restart: unless-stopped
    env_file: .env.prod
    deploy:
      replicas: 2

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports: ["80:80", "443:443"]
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on: [api, web, ai]

volumes:
  pg-data:
  redis-data:
```

### Environment variables (.env.prod)

Tất cả secret KHÔNG commit. Lưu ở:
- Production: copy lên VPS qua `scp`, chmod 600
- Hoặc: dùng SOPS + age (overkill cho solo Phase 1-6)

```
# Database
DATABASE_URL=postgresql://sociflow:STRONG_PW@postgres:5432/sociflow

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=STRONG_REDIS_PW

# Auth
JWT_SECRET=<32+ char random>
JWT_EXPIRY=7d
ENCRYPTION_KEY=<32 char random for AES-256>

# Internal
INTERNAL_TOKEN=<shared secret api↔ai>
AI_SERVICE_URL=http://ai:3001

# R2
R2_ACCOUNT_ID=...
R2_ACCESS_KEY=...
R2_SECRET_KEY=...
R2_BUCKET=sociflow-media
R2_PUBLIC_URL=https://cdn.sociflow.io

# OAuth providers
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=
INSTAGRAM_CLIENT_ID=
INSTAGRAM_CLIENT_SECRET=
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=

# AI providers
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
REPLICATE_API_TOKEN=

# Email
RESEND_API_KEY=

# Monitoring
SENTRY_DSN=
```

## CI/CD

### `.github/workflows/ci.yml`

```yaml
name: CI
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env: { POSTGRES_PASSWORD: test }
        ports: [5432:5432]
      redis:
        image: redis:7-alpine
        ports: [6379:6379]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm prisma migrate deploy
        env: { DATABASE_URL: postgres://postgres:test@localhost:5432/postgres }
      - run: pnpm lint
      - run: pnpm type-check
      - run: pnpm test
      - run: pnpm build
```

### `.github/workflows/deploy.yml`

```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions: { contents: read, packages: write }
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - run: |
          for service in api ai web; do
            docker buildx build -f apps/$service/Dockerfile -t ghcr.io/${{ github.repository_owner }}/sociflow-$service:latest --push .
          done

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /opt/sociflow
            docker compose pull
            docker compose run --rm api pnpm prisma migrate deploy
            docker compose up -d
```

## Database migration in production

KHÔNG dùng `prisma migrate dev`. Luôn:

```bash
# Trong CI hoặc trên VPS
pnpm prisma migrate deploy
```

Hoặc bằng container:

```bash
docker compose run --rm api pnpm prisma migrate deploy
```

Backup trước migration:

```bash
docker exec postgres pg_dump -U sociflow sociflow > backup-$(date +%Y%m%d).sql
```

Setup cron daily backup → upload R2 (qua `rclone`).

## Monitoring

### Logs

- pino → stdout → docker logs
- `loki` aggregate → Grafana
- Tag: `service=api|ai|web`

### Metrics

- BullMQ queue depth (qua `bull-prometheus-exporter`)
- HTTP latency (qua `nestjs-prometheus`)
- AI provider latency + cost (custom counter)
- DB connection pool

### Alerts (Grafana)

| Alert | Threshold |
|---|---|
| API 5xx rate | > 1% trong 5 min |
| Queue depth | > 1000 trong 10 min |
| DB disk free | < 20% |
| AI provider 4xx rate | > 10% trong 10 min |
| Account token expired | > 50 user impacted |

### Error tracking

Sentry SDK trong api/ai/web. Tag environment, release version.

## Domain & SSL

- Domain: `sociflow.io` (chính), `cdn.sociflow.io` (R2 custom domain)
- DNS: Cloudflare
- SSL: Cloudflare Universal SSL (đủ Phase 1-6)
- Khi cần origin SSL: Caddy hoặc certbot

## Scaling triggers

| Triệu chứng | Action |
|---|---|
| api CPU > 70% sustained | Tăng replica (2 → 4) |
| ai queue backlog growing | Tăng ai replica hoặc GPU instance |
| Postgres > 10K connection | Add pgbouncer |
| R2 cost > $50/mo | Optimize media size (transcoding) |
| Single VPS RAM cap | Tách Postgres ra managed service (Supabase / Neon) |

## Disaster recovery

- **DB backup**: daily pg_dump → R2 (giữ 30 ngày)
- **R2 versioning**: enable cho bucket media (giữ 7 ngày)
- **Code**: Git là source of truth, GHCR là build artifact
- **Recovery time target**: 1h cho full restore

## Tài liệu liên quan

- [02-architecture.md](02-architecture.md) — service topology
- [09-tech-stack.md](09-tech-stack.md) — version mỗi component
