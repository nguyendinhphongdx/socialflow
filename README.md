# Sociflow

> **Working name** — global rename khi chốt brand. Suggested alternatives: VinaPost, PostHub, ContentForge.

Nền tảng quản lý nội dung, tạo nội dung AI, tự động đăng bài đa nền tảng và theo dõi doanh thu cho creator/agency tại Việt Nam.

## Quick links

- 📋 [Product overview](docs/00-overview.md) — vấn đề, user, value proposition
- ✨ [Feature list](docs/01-features.md) — scope MVP và roadmap
- 🏗️ [Architecture](docs/02-architecture.md) — system design, 2-service split
- 🗄️ [Data model](docs/03-data-model.md) — Prisma schema
- 🚀 [Publish flow](docs/04-publish-flow.md) — flow đăng bài end-to-end
- 🤖 [Browser automation](docs/05-automation-extension.md) — kiến trúc extension
- 🧠 [AI services](docs/06-ai-services.md) — multi-provider AI gen
- 📱 [Platforms](docs/platforms/) — YouTube / Facebook / Instagram / TikTok
- 📐 [API conventions](docs/08-api-conventions.md) — DTO/VO, error codes
- 🛠️ [Tech stack](docs/09-tech-stack.md) — library choices + rationale
- 📦 [Deployment](docs/10-deployment.md) — Docker, R2, VPS
- 📅 [Roadmap](docs/11-roadmap.md) — kế hoạch 7.5 tháng
- 📖 [Glossary](docs/12-glossary.md)
- 🧭 [ADRs](docs/decisions/) — quyết định kiến trúc lớn

## For AI agents

Đọc [CLAUDE.md](CLAUDE.md) trước. Mọi quy tắc dev (coding style, git, security, testing) ở [.claude/rules/](.claude/rules/).

## Tech stack 1-liner

NestJS (api + ai) · Next.js 14 · Postgres + Prisma · BullMQ · Redis · Cloudflare R2 · Chrome Extension (MV3) · Turborepo · pnpm.

## Status

🟢 Phase 0 — skeleton scaffolded. Auth flow + Repository layer + CLS context ready. Apps build được, chưa có business feature ngoài auth.

## Quick start (dev)

Prereq: Node ≥22, pnpm ≥10, Docker Desktop.

```bash
# 1. Copy env
cp .env.example .env
# Edit .env — đặt JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, ENCRYPTION_KEY (≥32 chars / base64 32 bytes)
# Generate ENCRYPTION_KEY: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 2. Install deps
pnpm install

# 3. Start infra (postgres + redis + mailhog + minio)
docker compose -f docker-compose.dev.yml up -d

# 4. Generate Prisma client + migrate
pnpm --filter @sociflow/prisma generate
pnpm --filter @sociflow/prisma migrate:dev --name init

# 5. Seed admin user (optional)
pnpm --filter @sociflow/api cli seed

# 6. Run all services
pnpm dev
```

Endpoints:

- API: <http://localhost:3000/api/v1> · Swagger: <http://localhost:3000/api/v1/docs>
- AI: <http://localhost:3001/api/v1> · Swagger: <http://localhost:3001/api/v1/docs>
- Web: <http://localhost:3020>
- MailHog UI: <http://localhost:8025>
- MinIO Console: <http://localhost:9001> (minio / minio12345)
