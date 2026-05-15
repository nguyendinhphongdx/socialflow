---
title: System architecture
description: Kiến trúc tổng thể, bố cục monorepo, service split, communication patterns
audience: [developer, ai-agent, architect]
---

# System architecture

## Big picture

```
┌──────────────────────────────────────────────────────────────────────┐
│                           USERS                                      │
└──────────────────────────────────────────────────────────────────────┘
            │                          │
   ┌────────▼────────┐       ┌─────────▼─────────┐
   │  Web (Next.js)  │       │  Browser Extension │
   │  apps/web       │       │  apps/extension    │
   │  - SaaS UI      │       │  - DOM automation  │
   │  - Calendar     │       │  - WS to api       │
   │  - Editor       │       │                    │
   └────────┬────────┘       └─────────┬──────────┘
            │ HTTPS/REST              │ WebSocket
            │ + WS (push notif)       │
            └─────────┬────────────────┘
                      ▼
           ┌──────────────────────────┐
           │   nginx reverse proxy    │
           └──────────────┬───────────┘
                          │
        ┌─────────────────┼──────────────────┐
        ▼                 ▼                  ▼
┌─────────────┐  ┌──────────────────┐  ┌──────────────┐
│  apps/api   │  │  apps/ai         │  │ R2 (S3)      │
│  NestJS     │  │  NestJS          │  │ media bucket │
│  :3000      │  │  :3001           │  │              │
│             │  │                  │  └──────────────┘
│ - auth      │  │ - llm gateway    │
│ - accounts  │  │ - image gen      │
│ - publish   │◄─┤ - video gen      │
│ - engage    │  │ - agent runtime  │
│ - automation│  │                  │
│   gateway   │  │                  │
└──────┬──────┘  └────────┬─────────┘
       │                  │
       └────────┬─────────┘
                ▼
   ┌──────────────────────────────┐
   │  Postgres 16  +  Redis 7     │
   │  Prisma         BullMQ       │
   └──────────────────────────────┘
                ▲
                │ Provider HTTP calls
                │
   ┌────────────┴───────────────────────────────┐
   │ External: YouTube/FB/IG/TikTok/OpenAI/...  │
   └────────────────────────────────────────────┘
```

## Tại sao tách 2 service `api` và `ai`?

(Lý do giống AiToEarn — pattern đã proven)

1. **Resource pattern khác nhau**: `api` request ngắn (CRUD, OAuth, < 500ms). `ai` request dài (gen video 5 phút, gen image 30s).
2. **Scale độc lập**: viral campaign → cần 5x api, 1x ai. Batch video gen → cần 10x ai, 1x api.
3. **Cô lập failure**: OOM khi gen video chỉ kill `ai`, web vẫn login được qua `api`.
4. **Dependency nặng**: `ai` có OpenAI/Anthropic/Replicate SDK + ffmpeg. `api` không cần → image size khác xa.
5. **Security**: API key đắt (GPT-4, Veo) chỉ ở `ai`, giảm blast radius.
6. **Cost**: `ai` có thể chạy GPU instance, `api` chạy VPS rẻ.

→ Tách **NGAY TỪ ĐẦU** dù đang solo, vì chuyển từ monolith → split sau này tốn đau.

## Monorepo layout

```
sociflow/
├── apps/
│   ├── api/                      # Main backend (NestJS)
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── config.ts
│   │   │   ├── core/
│   │   │   │   ├── auth/
│   │   │   │   ├── user/
│   │   │   │   ├── account/      # Social accounts (platform connections)
│   │   │   │   ├── media/        # R2 upload, pre-signed URLs
│   │   │   │   ├── publish/
│   │   │   │   │   ├── publish.controller.ts
│   │   │   │   │   ├── publish.service.ts
│   │   │   │   │   ├── providers/    # Strategy: youtube, fb, ig, tt, automation
│   │   │   │   │   └── consumers/    # BullMQ workers
│   │   │   │   ├── engagement/
│   │   │   │   ├── analytics/
│   │   │   │   ├── automation/   # WS gateway, agent dispatcher
│   │   │   │   ├── credits/
│   │   │   │   ├── notification/
│   │   │   │   └── webhook/      # FB/TT/YT webhooks
│   │   │   └── common/
│   │   ├── test/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── ai/                       # AI service (NestJS)
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── core/
│   │   │   │   ├── chat/         # Text gen
│   │   │   │   ├── image/        # Image gen
│   │   │   │   ├── video/        # Video gen
│   │   │   │   ├── agent/        # Agent loop, MCP tools
│   │   │   │   └── providers/    # OpenAI, Anthropic, Gemini, Replicate, Veo
│   │   │   └── common/
│   │   └── package.json
│   │
│   ├── web/                      # Next.js SaaS
│   │   ├── src/
│   │   │   ├── app/              # App router
│   │   │   ├── components/
│   │   │   ├── lib/
│   │   │   └── api/              # API client (ts-rest)
│   │   ├── public/
│   │   └── package.json
│   │
│   └── extension/                # Chrome MV3
│       ├── src/
│       │   ├── background/       # Service worker, WS client
│       │   ├── content-scripts/  # Per-platform DOM automation
│       │   │   ├── tiktok.ts
│       │   │   ├── facebook.ts
│       │   │   ├── instagram.ts
│       │   │   └── youtube.ts
│       │   ├── popup/            # Extension popup UI
│       │   └── offscreen/        # MV3 offscreen documents (file ops)
│       ├── manifest.json
│       └── package.json
│
├── packages/
│   ├── common/                   # AppException, ResponseCode, zod helpers
│   ├── prisma/                   # Prisma schema + generated client + migrations
│   ├── api-contracts/            # ts-rest contracts (FE/BE type sync)
│   ├── auth/                     # JWT, OAuth helpers, Guards
│   ├── queue/                    # BullMQ wrapper
│   ├── storage/                  # R2 client + media-staging
│   ├── ws-protocol/              # WebSocket protocol (api ↔ extension)
│   ├── logger/                   # pino + nestjs adapter
│   └── config/                   # zod config schema loader
│
├── docs/
├── .claude/
├── docker-compose.yml            # Local dev: postgres + redis + minio
├── docker-compose.prod.yml       # Production
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
└── tsconfig.json
```

### Quy tắc nhập module

- `apps/api` import được `packages/*` (trừ `apps/ai`)
- `apps/ai` import được `packages/*` (trừ `apps/api`)
- `apps/web` import được `packages/api-contracts`, `packages/common` (chỉ phần types), KHÔNG import packages/auth, prisma, queue
- `apps/extension` import được `packages/ws-protocol`, `packages/common` (types only)
- `packages/*` không import lẫn nhau lung tung — chỉ theo dependency tree định nghĩa

→ Enforce qua `eslint-plugin-import` + `tsconfig` references.

## Communication patterns

### 1. Web ↔ API (REST + WS)

- **REST**: 95% interaction. ts-rest contract đảm bảo type sync.
- **WS** (Socket.io): chỉ cho push notification realtime (publish status, new comment).
- **Auth**: JWT trong `Authorization: Bearer` header. Refresh token qua cookie httpOnly.

### 2. API ↔ AI (HTTP internal)

- HTTP REST giữa 2 service.
- Auth bằng `INTERNAL_TOKEN` shared secret (header `x-internal-token`).
- Pattern: API → enqueue job → worker call AI → AI return tracking ID → worker poll/await callback.
- Long job: AI service call back API qua webhook URL khi xong.

### 3. API ↔ Extension (WS)

- WebSocket long-lived (Socket.io hoặc native ws).
- Auth bằng `agentToken` (long-lived JWT, do user pair tạo).
- Protocol: xem [05-automation-extension.md](05-automation-extension.md).

### 4. API/AI ↔ External providers (HTTP)

- OAuth API: dùng SDK khi có (`googleapis`, `facebook-nodejs-business-sdk`), tự code khi không có (TikTok).
- AI provider: dùng official SDK (`openai`, `@anthropic-ai/sdk`).
- Rate limit per provider qua Redis token bucket.

## Queue topology

Một Redis instance, nhiều queue:

| Queue name | Producer | Consumer | Job type |
|---|---|---|---|
| `publish:immediate` | `publish.service` | `apps/api/publish/consumers/immediate.consumer.ts` | Đăng ngay (≤5s tới publishTime) |
| `publish:finalize` | provider sau khi publish | `apps/api/publish/consumers/finalize.consumer.ts` | Update record, notify user |
| `publish:scheduled-tick` | cron 1 phút | `apps/api/publish/consumers/scheduled.consumer.ts` | Quét record tới hạn, enqueue immediate |
| `ai:image-gen` | `ai.service` | `apps/ai/.../image.consumer.ts` | Gen ảnh |
| `ai:video-gen` | `ai.service` | `apps/ai/.../video.consumer.ts` | Gen video |
| `engagement:fetch-comments` | cron 10 phút | `apps/api/engagement/.../fetch.consumer.ts` | Pull comment mới |
| `engagement:auto-reply` | comment fetch | `apps/api/engagement/.../reply.consumer.ts` | Gen + post reply |
| `notification:email` | event emit | `apps/api/notification/.../email.consumer.ts` | Send email |
| `analytics:daily-snapshot` | cron 0 0 * * * | `apps/api/analytics/.../snapshot.consumer.ts` | Pull insight, lưu snapshot |

Tất cả queue có:
- Default: 3 retry với exponential backoff (1s, 5s, 30s)
- Dead letter queue: `<name>:dead`
- Job ID idempotent (vd `publish:${recordId}`) để chống duplicate

## Configuration

Mỗi service có `config.ts` dùng zod load + validate từ `process.env`:

```ts
// apps/api/src/config.ts
import { z } from 'zod'

export const ConfigSchema = z.object({
  port: z.coerce.number().default(3000),
  database: z.object({
    url: z.string().url(),
  }),
  redis: z.object({
    host: z.string(),
    port: z.coerce.number(),
    password: z.string().optional(),
  }),
  storage: z.object({
    r2AccountId: z.string(),
    r2AccessKey: z.string(),
    r2SecretKey: z.string(),
    r2Bucket: z.string(),
    r2PublicUrl: z.string().url(),
  }),
  auth: z.object({
    jwtSecret: z.string().min(32),
    jwtExpiry: z.string().default('7d'),
  }),
  internal: z.object({
    aiServiceUrl: z.string().url(),
    internalToken: z.string().min(16),
  }),
  // ... OAuth providers
})

export const config = ConfigSchema.parse(process.env)
```

→ Service **fail-fast** lúc startup nếu config thiếu/sai. Không bao giờ `process.env.X` rải rác trong code.

## Observability

- **Logger**: pino → JSON stdout → Loki (production)
- **Metrics**: Prometheus exporter (BullMQ queue depth, HTTP latency, AI provider latency)
- **Error tracking**: Sentry (frontend + backend)
- **Tracing**: OpenTelemetry → Jaeger (optional, phase 7+)

## Security boundary

| Boundary | Auth mechanism |
|---|---|
| Web → API | JWT (access) + httpOnly cookie (refresh) |
| Extension → API WS | Long-lived agent JWT (revocable, paired) |
| API → AI | `x-internal-token` shared secret |
| Public webhook (TT/FB) | Platform signature verify |
| API → external (OAuth) | Per-account access token |
| Admin endpoints | Role check via `@Roles('admin')` |

Chi tiết: [.claude/rules/security.md](../.claude/rules/security.md).

## Deployment topology (production target)

```
                   ┌─────────────────┐
                   │  Cloudflare DNS │
                   │  + DDoS         │
                   └────────┬────────┘
                            ▼
                   ┌─────────────────┐
                   │  Hetzner VPS    │
                   │  (CPX31, €15/mo)│
                   │                 │
                   │  Docker:        │
                   │  - nginx        │
                   │  - api (×2)     │
                   │  - ai (×1)      │
                   │  - web (×2)     │
                   │  - postgres     │
                   │  - redis        │
                   │                 │
                   └─────────────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │  Cloudflare R2  │
                   │  (media bucket) │
                   └─────────────────┘
```

Scale up khi cần: tách Postgres ra managed service, AI ra GPU instance riêng.

## Khác biệt cốt lõi so với AiToEarn

| Aspect | AiToEarn | Sociflow |
|---|---|---|
| DB | MongoDB | **Postgres** |
| ORM | Mongoose | **Prisma** |
| Monorepo tool | Nx | **Turborepo** |
| FE/BE type sync | Tay viết | **ts-rest** |
| Object storage | RustFS/Aliyun OSS | **Cloudflare R2** |
| i18n | locize SaaS | **next-i18next** (local JSON) |
| UI | AntD + Radix mixed | **shadcn/ui only** |
| Desktop client | Electron + legacy backend | **Bỏ — chỉ Chrome extension** |
| Marketplace | Có | **Bỏ** |
| Chinese platforms | Có | **Bỏ** |
| Test coverage rule | 80% (chưa enforce) | **Enforce qua CI** |
