---
title: Tech stack
description: Library choices + rationale + alternatives considered
audience: [developer, ai-agent]
---

# Tech stack

Tổng hợp lựa chọn + lý do. Tránh debate sau này.

## Runtime & language

| Component | Choice | Version | Lý do |
|---|---|---|---|
| Node.js | LTS | 22.x | Stable, AGI/SWC ổn |
| TypeScript | strict | 5.9+ | Type safety, ecosystem |
| Package manager | **pnpm** | 10.x | Fast, disk-efficient, workspace tốt cho monorepo |
| Monorepo | **Turborepo** | 2.x | Đơn giản hơn Nx cho solo, cache build tốt |

## Backend

| Component | Choice | Lý do |
|---|---|---|
| Framework | **NestJS** | 11 | DI, module system, ecosystem mature |
| Validation | **zod** | 4.x | Type inference > runtime check, single source of truth với DTO/VO |
| DB | **Postgres** | 16 | RDBMS, JSON support, pgvector cho RAG sau này |
| ORM | **Prisma** | 5.x | Type-safe, migration tốt, dx > Drizzle cho solo |
| Cache & Queue broker | **Redis** | 7 | Standard, BullMQ require |
| Queue | **BullMQ** | 5.x | Battle-tested, hỗ trợ delayed/scheduled/repeat jobs |
| WebSocket | **Socket.io** | 4.x | Auto reconnect, namespace, rooms — match extension use case |
| HTTP client | **axios** + **undici** | - | axios cho REST, undici cho streaming media |
| Auth | **passport** + **jsonwebtoken** | - | Standard NestJS pattern |
| Logger | **pino** | - | Fast JSON logger |
| Test | **Vitest** | 4.x | Fast, ESM-native |

### Alternatives considered

- **Drizzle vs Prisma**: Drizzle gọn hơn, type-safe hơn nhưng tooling kém, migration phải tự manage. Chọn Prisma cho solo vì DX.
- **Fastify vs Express**: NestJS support cả 2. Chọn Express adapter (default) cho ecosystem rộng hơn.
- **NATS/RabbitMQ vs BullMQ**: BullMQ nhẹ + đủ dùng. Chỉ cần message queue, không cần pub/sub phức tạp.

## AI service stack (apps/ai)

| Component | Choice |
|---|---|
| LLM SDK (OpenAI) | `openai` 4.x |
| LLM SDK (Anthropic) | `@anthropic-ai/sdk` 0.x |
| LLM SDK (Gemini) | `@google/generative-ai` |
| Image gen | Direct API: DALL-E, **Replicate** (Flux), Imagen |
| Video gen | **Replicate** (Seedance, Veo when available), or direct Veo API |
| Audio | Whisper qua OpenAI |
| Video processing | **ffmpeg** binary (qua `fluent-ffmpeg`) |
| Streaming SSE | `nestjs-sse` hoặc Socket.io |

## Frontend (apps/web)

| Component | Choice | Lý do |
|---|---|---|
| Framework | **Next.js** | 14 | App Router, SSR, ecosystem |
| React | 18 | Stable, ecosystem |
| UI library | **shadcn/ui** (Radix) | Copy-paste components, fully customizable, no theme conflict |
| Styling | **Tailwind v4** | Utility-first, perf tốt |
| State | **zustand** | Đơn giản, hooks-based, ko Redux boilerplate |
| Form | **react-hook-form** + zod | Sync với DTO schema backend |
| Date | **dayjs** | Nhẹ hơn moment, immutable |
| Charts | **echarts** hoặc **recharts** | Recharts dễ hơn |
| Calendar | **FullCalendar** | Mature, drag-drop |
| API client | **ts-rest** | Type sync với backend |
| HTTP | axios | Familiar |
| i18n | **next-i18next** + JSON local | Không phí locize |
| Icons | **lucide-react** | Tree-shakable, đẹp |
| Toast | **sonner** | Modern, đẹp |
| Editor | **lexical** (Meta) | Mạnh cho rich editor |

### Alternatives considered

- **shadcn vs Mantine vs AntD**: shadcn ownership của code (paste vào repo), không lock vendor. Mantine + AntD đẹp nhưng theming conflict với Tailwind.
- **TanStack Query vs ts-rest**: ts-rest có type + contract enforcement. Có thể kết hợp: ts-rest cho REST, TanStack Query cho caching.
- **Jotai vs zustand**: zustand đơn giản và đủ cho hầu hết case.

## Browser extension (apps/extension)

| Component | Choice | Lý do |
|---|---|---|
| Manifest | **MV3** | Required by Chrome 2024+ |
| Bundler | **esbuild** + **tsup** | Fast |
| WS client | **socket.io-client** | Match server |
| File ops | **MV3 offscreen documents** | Workaround service worker limit |
| Lib mouse/keyboard | (nếu cần) **ghost-cursor** | Anti-detection |

### Cấm

- ❌ Puppeteer / Playwright (bị platform detect)
- ❌ `chrome.debugger` (DevTools protocol — detect)
- ❌ Bundle 3rd-party CDN (CSP fail)

## Storage

| Component | Choice | Lý do |
|---|---|---|
| Object storage | **Cloudflare R2** | S3-compatible, $0 egress, rẻ ~10x AWS |
| Local dev | **MinIO** (Docker) | S3-compatible mock |
| CDN | Cloudflare (đi kèm R2) | Auto, không setup thêm |

R2 bucket structure:

```
sociflow-media/
├── user-uploads/{userId}/{cuid}/{filename}
├── ai-gen/{jobId}.{ext}
├── thumbnails/{mediaId}.jpg
├── automation-errors/{taskId}.png    # screenshot khi automation fail
└── temp/{cuid}                       # TTL 24h
```

## Infrastructure

| Component | Choice |
|---|---|
| Container | Docker + docker-compose |
| Reverse proxy | nginx |
| SSL | Cloudflare (or Caddy auto-renew) |
| VPS (production) | Hetzner CPX31 (€15/mo) |
| DNS + DDoS | Cloudflare |
| Monitoring | Grafana + Loki + Prometheus (qua docker) |
| Error tracking | Sentry (free tier) |
| Email | Resend (5K free) |
| SMS (optional) | esms.vn (VN) |

## Build tooling

| Tool | Use |
|---|---|
| **ESLint** flat config + `@antfu/eslint-config` | Lint |
| **Prettier** (qua Antfu config) | Format |
| **tsc --noEmit** | Type check (KHÔNG dùng `next build` để type check) |
| **simple-git-hooks** | Pre-commit hooks |
| **lint-staged** | Lint chỉ file changed |
| **commitlint** | Enforce conventional commits |

## CI/CD

| Component | Choice |
|---|---|
| CI | **GitHub Actions** |
| Steps mỗi PR | lint + type-check + test + build |
| Deployment | docker-compose pull on VPS via webhook + SSH |
| Image registry | GitHub Container Registry (free) |
| Database migration | `prisma migrate deploy` step trong CI |

## Pinning strategy

- **Lock file committed**: `pnpm-lock.yaml`
- **Major version pin** ở `package.json` (vd `"nestjs": "^11.0.0"`)
- **Patch update tự động** qua Renovate Bot
- **Major update** thủ công, có ADR

## Security tooling

| Tool | Use |
|---|---|
| **helmet** | NestJS security headers |
| **bcryptjs** | Password hashing |
| **jose** | JWT sign/verify (alt: jsonwebtoken) |
| **express-rate-limit** | Rate limit |
| **dompurify** | HTML sanitize (cho rich text user input) |
| **OWASP ZAP** | Periodic security scan |

## Tham khảo so với AiToEarn

| | AiToEarn | Sociflow | Note |
|---|---|---|---|
| Backend FW | NestJS | NestJS | Same |
| Monorepo | Nx | **Turborepo** | Đơn giản hơn cho solo |
| DB | MongoDB | **Postgres** | Type safety, transaction, foreign key |
| ORM | Mongoose | **Prisma** | Migration tự động |
| Validation | zod (DTO) | zod (DTO + ts-rest) | Cộng thêm ts-rest cho FE/BE sync |
| Web | Next.js 14 | Next.js 14 | Same |
| UI mix | AntD + Radix | **shadcn only** | Tránh conflict theming |
| Object storage | RustFS/Aliyun OSS | **Cloudflare R2** | $0 egress |
| Object storage local | RustFS Docker | MinIO Docker | More mainstream |
| Desktop client | Electron | **None** (Chrome extension) | Solo không kham được Electron |
| i18n | locize SaaS | **next-i18next** | Tiết kiệm |
| Test runner | Vitest | Vitest | Same |
| State (FE) | zustand | zustand | Same |

## Khi nào thay đổi stack?

Có thể đề xuất ADR thay đổi khi:

- **Critical issue** với library hiện tại (CVE, abandoned)
- **Performance regression** đo được
- **DX cost** quá cao (vd Prisma type instantiation timeout với schema lớn)

Không thay đổi vì:
- Cá nhân thích library khác
- "Mới hơn = tốt hơn"
- Hype Twitter

## Tài liệu liên quan

- [02-architecture.md](02-architecture.md) — service split
- [decisions/](decisions/) — ADRs cụ thể
