---
title: Sociflow — Progress tracker
description: Trạng thái build theo roadmap. Update mỗi khi đẩy feature mới.
last_updated: 2026-05-17
revision: 7 — Wave 1-9 multi-agent execution: security/layering/tests, F-7xx complete (21/23), Phase 5+6 polish, F-716 multi-tenant landed
---

# Sociflow Progress Tracker

> Tracking theo [docs/11-roadmap.md](docs/11-roadmap.md). Format:
> ✅ done · 🟡 partial · ⏳ pending · ❌ blocked

## Quick status

| Phase | Mục tiêu | Status |
|---|---|---|
| **0** | Foundation (monorepo + auth + DB + CI) | ✅ |
| **1** | YouTube publish (connect, upload, publish) | ✅ |
| **2** | FB + IG + TT publish (multi-platform) | ✅ |
| **3** | UI complete (editor, calendar, drafts) | ✅ |
| **4** | AI content gen (caption + image) | ✅ |
| **5** | Browser extension automation | ✅ scaffold (4 platforms content script, real DOM selectors pending browser inspect) |
| **6** | Engagement + Analytics | ✅ (BrandMention persist + IG/TT insight real + inbox bulk + Web Push) |
| **7** | Polish + Launch | ✅ (21/23 features; F-714 external + F-716 done) |

> **Note**: ✅ = code đã viết & build path sạch. **Smoke test thực tế** với OAuth credentials & API keys riêng cần thực hiện mỗi phase.
>
> ⚠️ `✅ scaffold` (Phase 5) **khác** `✅` phase done. Xem [docs/definition-of-done.md](docs/definition-of-done.md) cho định nghĩa formal 3 mức done (code / feature / phase) và checklist gate trước khi tick ✅ thật.

## Verification snapshot (revision 7)

- **Type-check**: 13/13 packages green
- **Tests**: 186 pass (151 api + 17 common + 18 auth)
- **Build**: api + ai + web tất cả clean
- **Code stats**: 194 file changed, +6610/-816 dòng so với scaffold ban đầu
- **Migrations**: 17 prisma migrations (workspace, credits, notifications, api-key, brand-mentions, push-subscription, ...)

---

## Detailed status

### Phase 0 — Foundation ✅

| Area | Status | Files |
|---|---|---|
| Turborepo + pnpm workspace | ✅ | `package.json`, `pnpm-workspace.yaml`, `turbo.json` |
| TypeScript base config | ✅ | `tsconfig.base.json`, mỗi package có `tsconfig.json` riêng |
| ESLint @antfu + Prettier + commitlint | ✅ | `eslint.config.mjs`, `.prettierrc`, `commitlint.config.cjs` |
| Docker dev stack (Postgres 16 / Redis 7 / MailHog / MinIO) | ✅ | `docker-compose.dev.yml` — ports lệch (5433/6380) tránh agentforge |
| `.env` validated qua zod | ✅ | `apps/api/src/config/{config.schema,config.loader}.ts` |
| `packages/common` — ResponseCode, AppException, zod helpers, decorators, filters, pipes, crypto AES-256-GCM | ✅ | `packages/common/src/**` |
| `packages/prisma` — schema (User/Session/ApiKey + 4 migrations applied), PrismaService với `cleanDatabase()` | ✅ | `packages/prisma/{schema.prisma,migrations,src}` |
| `packages/auth` — JwtStrategy (cookie+Bearer dual), JwtAuthGuard (CLS populate), OptionalAuthGuard, ContextModule, SessionRepository (rotate + replay detect), cookie helpers | ✅ | `packages/auth/src/**` |
| `packages/queue` — BullMQ QueueProducer + `runWithJobContext` (CLS propagation) | ✅ | `packages/queue/src/**` |
| `packages/oauth` — OAuthService (state machine + PKCE), provider configs cho Google/YouTube/Facebook/Instagram/TikTok | ✅ | `packages/oauth/src/**` |
| `packages/internal-client` — `createInternalClient` axios + `InternalTokenGuard` + `AiClientService` | ✅ | `packages/internal-client/src/**` |
| `packages/storage` — S3/R2 client với pre-signed URL | ✅ | `packages/storage/src/**` |
| `apps/api` skeleton + main.ts wire-up (cookieParser + helmet + CORS + pipe + interceptor + filter + Swagger non-prod + raw body capture cho webhook) | ✅ | `apps/api/src/main.ts` |
| Auth module — email/pw register/login/refresh/logout/me, Google OAuth login | ✅ | `apps/api/src/core/auth/**` |
| `apps/ai` skeleton + AppConfig + AI providers + generation endpoints | ✅ | `apps/ai/src/**` |
| `apps/web` skeleton — providers (QueryClient via useState), axios 401 single-flight refresh, AuthGuard, edge middleware cookie gate, SEO helper | ✅ | `apps/web/src/**` |
| `apps/extension` MV3 skeleton (bg + content + popup placeholder) | ✅ skeleton | `apps/extension/src/**` |
| CLI runner (`pnpm --filter @sociflow/api cli seed`) | ✅ | `apps/api/src/cli/**` |
| GitHub Actions CI (lint+type+test+build + security + dependabot + PR template) | ✅ | `.github/workflows/*` |
| MCP `.mcp.json` (filesystem + memory server) | ✅ | `.mcp.json` |
| 7 ADR | ✅ | `docs/decisions/0001-0007` |

### Phase 1 — YouTube publish ✅

| Task | Status | Files |
|---|---|---|
| SocialAccount + AccountGroup + OAuthState schema | ✅ | `packages/prisma/schema.prisma` |
| YouTube OAuth flow (connect → callback → save encrypted tokens) | ✅ | `apps/api/src/core/social-account/youtube-connect.service.ts` |
| SocialAccountRepository + Service + Controller | ✅ | `apps/api/src/core/social-account/**` |
| Token refresh BullMQ scheduled job (cron 5m) + consumer | ✅ | `token-refresh.{scheduler,consumer}.ts` |
| Media schema (MediaAsset) | ✅ | `packages/prisma/schema.prisma` |
| Media upload pre-signed URL endpoint (`POST /media/upload-url` + confirm) | ✅ | `apps/api/src/core/media/**` |
| Web media uploader (drag-drop, XHR progress, dimension/duration probe) | ✅ | `apps/web/src/features/media/**` |
| PublishRecord schema + service + controller (bundle create + idempotency) | ✅ | `apps/api/src/core/publish/**` |
| YouTubeProvider (videos.insert resumable upload) | ✅ | `apps/api/src/core/publish/providers/youtube.provider.ts` |
| BullMQ publish-immediate consumer + dispatcher | ✅ | `apps/api/src/core/publish/publish.consumer.ts` |
| Web compose + publish list + cancel | ✅ | `apps/web/src/features/{compose,publish}/**` |
| Smoke test guide | ✅ | `docs/runbooks/smoke-test-phase1.md` |

**TODO Phase 1 polish**:
- ⏳ Test thật end-to-end với Google Cloud OAuth credentials thật
- ⏳ Fix MinIO CORS để browser PUT trực tiếp được
- ⏳ Verify YouTube channel quota (10K units/day free tier ~= 6 video/day)

### Phase 2 — Multi-platform ✅

| Platform | OAuth connect | Publish provider | Web button |
|---|---|---|---|
| YouTube | ✅ | ✅ Resumable upload | ✅ `+ YouTube` |
| Facebook | ✅ Long-lived token + page list | ✅ Text / Photo / Video | ✅ `+ Facebook` |
| Instagram | ✅ via FB pages có IG Business linked | ✅ 2-step container + Reels support | ✅ `+ Instagram` |
| TikTok | ✅ PKCE + Content Posting API | ✅ Direct Post + status polling | ✅ `+ TikTok` |

| Sub-feature | Status |
|---|---|
| Webhook controller (Meta HMAC verify) | ✅ `/webhook/facebook` + raw body middleware |
| Webhook IG/TT | ⏳ stub (handleOther catches all, no DB persist) |
| Multi-account select trong compose | ✅ AccountMultiSelect component |
| Bundle publish (1 request → N record cho N account, parallel dispatch) | ✅ flowId + idempotencyKey |
| Per-platform options (FB content_category, IG reel/post, TT privacy) | 🟡 Schema field `platformOptions: Json?` đã có. UI chưa expose per-platform form |

**Pre-launch checklist (Phase 2)**:
- ⏳ Đăng ký Meta for Developers App + App Review cho `pages_manage_posts`, `pages_read_engagement`, `instagram_content_publish`, `business_management` scopes
- ⏳ Đăng ký TikTok For Developers app, request **Content Posting API** + Direct Post scope (review 2-4 tuần)
- ⏳ Add OAuth credentials thật vào `.env`
- ⏳ MinIO bucket public read + CORS để Meta/TT có thể fetch video URL

### Phase 3 — UI complete ✅

| Feature | Status | Files |
|---|---|---|
| Rich text editor (Tiptap StarterKit + Link + Placeholder, toolbar B/I/S/list/link) | ✅ | `apps/web/src/features/compose/components/RichTextEditor.tsx` |
| Media library picker modal (tab Thư viện + Upload mới, multi-select) | ✅ | `apps/web/src/features/compose/components/MediaPickerModal.tsx` |
| Multi-account select (checkboxes + platform color) | ✅ | `apps/web/src/features/compose/components/AccountMultiSelect.tsx` |
| Schedule picker (now / later datetime-local) | ✅ | `apps/web/src/features/compose/components/SchedulePicker.tsx` |
| Calendar view (FullCalendar — month/week/day, drag-drop placeholder) | ✅ | `apps/web/src/features/calendar/views/CalendarView.tsx` |
| Drafts CRUD (BE module + Web feature: list/create/edit/publish/delete) | ✅ | `apps/api/src/core/draft/**` + `apps/web/src/features/drafts/**` |
| TagInput chip-style component | ✅ | `apps/web/src/features/drafts/components/TagInput.tsx` |
| Routes: `/dashboard/{calendar,drafts,drafts/new,drafts/[id],drafts/[id]/publish}` | ✅ | `apps/web/src/app/(dashboard)/**` |

**TODO Phase 3 polish**:
- ⏳ Per-platform preview (FB/IG/TT/YT mockup card)
- ⏳ Drag-drop scheduled time trên calendar (FullCalendar có `editable: true`)
- ⏳ i18n VN + EN (next-intl) — hiện chỉ tiếng Việt
- ⏳ Mobile responsive (đã có tailwind breakpoints sẵn — chưa verify trên thiết bị)
- ⏳ Settings page (profile, API key list, notification preferences)

### Phase 4 — AI content gen ✅

| Endpoint | Status | Files |
|---|---|---|
| `apps/ai`: `POST /internal/ai/caption` (InternalTokenGuard, multi-provider) | ✅ | `apps/ai/src/core/generation/**` |
| `apps/ai`: `POST /internal/ai/image` (DALL-E 3) | ✅ | `apps/ai/src/core/generation/**` |
| Provider abstraction (OpenAI / Anthropic / configurable) | ✅ | `apps/ai/src/core/providers/**` |
| `apps/api`: `POST /ai/caption` (user-facing, JWT auth, credit check + decrement) | ✅ | `apps/api/src/core/ai/**` |
| Web: AI Assist button + popover (topic + tone + platform infer + includeHashtags) | ✅ | `apps/web/src/features/compose/components/AiAssistButton.tsx` |
| Credit display + insufficient flow | ✅ | UserService `assertAiCredits` + `decrementAiCredits` |

**TODO Phase 4 polish**:
- ⏳ Image gen UI (chưa có button trên compose — chỉ caption)
- ⏳ Caption regen với "Try again" preserving last input
- ⏳ Cost tracking per provider (currently 1 credit/call flat)
- ⏳ Video gen (Veo / Replicate / Runway) — Phase 4 stretch goal
- ⏳ Pre-flight credit quote (display "Sẽ tốn N credit" trước khi user click)

### Phase 5 — Extension automation ✅ scaffold

| Task | Status | Files |
|---|---|---|
| MV3 skeleton (manifest, bg, content, popup) | ✅ | `apps/extension/**` |
| WS protocol package (`@sociflow/ws-protocol`) — zod-validated messages | ✅ | `packages/ws-protocol/src/{messages,pair,platforms}.ts` |
| AutomationAgent + AutomationTask schema + migration | ✅ | `automation-agents` migration |
| Pair flow BE (init + claim, atomic, sha256 token hash) | ✅ | `apps/api/src/core/agent/**` |
| WS Gateway (Socket.IO `/agents`, auth handshake, 6 event handlers) | ✅ | `apps/api/src/core/agent/ws/agent.gateway.ts` |
| Agent registry (Redis online/offline, TTL extend) | ✅ | `agent-registry.service.ts` |
| AgentDispatcherService (server-to-agent command emit) | ✅ | `agent-dispatcher.service.ts` |
| AutomationTask service + repo | ✅ | `automation-task.{repository,service}.ts` |
| Extension popup pair UI (6-digit form, paired state, disconnect) | ✅ | `apps/extension/src/popup/{popup.html,popup.ts}` |
| Extension WS client (socket.io-client, exp backoff, heartbeat) | ✅ | `apps/extension/src/background/{index,ws-client,task-dispatcher,storage}.ts` |
| TikTok content script (publish stub với 5 stage progress events) | ✅ stub | `apps/extension/src/content-scripts/tiktok.ts` |
| FB / IG / YT content scripts | 🟡 placeholder | `apps/extension/src/content-scripts/{facebook,instagram,youtube}.ts` |
| PublishConsumer integration (AUTOMATION mode → AgentDispatcher) | ✅ | `apps/api/src/core/publish/publish.consumer.ts` |
| Web Devices page (list, pair dialog với countdown, revoke) | ✅ | `apps/web/src/features/devices/**` + `/dashboard/devices` |

**Phase 5 polish — pending**:
- ⏳ Real TikTok DOM selectors (data-e2e attrs, React state injection)
- ⏳ Blob → DataTransfer file injection (CORS proxy via SW)
- ⏳ Caption editor synthetic events cho Lexical/Draft.js
- ⏳ Redirect detection via `chrome.webNavigation.onCommitted`
- ⏳ Human-like timing (random 300-1500ms jitter)
- ⏳ Screenshot on failure → upload R2
- ⏳ Persistent task↔tab map → `chrome.storage.session`
- ⏳ Selector hot-update từ server
- ⏳ FB/IG/YT DOM automation

### Phase 6 — Engagement + Analytics ✅ scaffold

| Task | Status | Files |
|---|---|---|
| Schema migration (Comment + AutoReplyRule + BrandMonitor + PostInsight + AccountInsight) | ✅ | migration `engagement` |
| CommentModule BE (CRUD + ingest idempotent + reply via provider) | ✅ | `apps/api/src/core/comment/**` |
| Comment providers (FB/IG/YT graph reply, TT stub) | ✅ | `comment/providers/**` |
| Webhook ingest FB + IG → CommentService → emit `comment.new` | ✅ | `webhook.service.ts` |
| CommentSync cron (TT 15m, YT 15m) + BullMQ consumer | ✅ | `comment/sync/**` |
| AutoReplyRule CRUD + match logic (any/all/none keywords) | ✅ | `apps/api/src/core/auto-reply/**` |
| AutoReplyProcessor (`@OnEvent`) + delayed queue + atomic daily quota | ✅ | `auto-reply.{processor,consumer}.ts` |
| BrandMonitor CRUD + scheduler 10m (search stubs) | ✅ | `apps/api/src/core/brand-monitor/**` |
| Insight providers (FB + YT real, IG + TT stub) | ✅ | `apps/api/src/core/insight/providers/**` |
| InsightService snapshotPostInsight + rollupAccountDailyInsight | ✅ | `insight.service.ts` |
| InsightSchedulers (post snapshot 6h, account rollup daily 1AM) | ✅ | `insight.scheduler.ts` + consumer |
| Web Inbox (filter + reply dialog + mark/delete) | ✅ | `apps/web/src/features/inbox/**` |
| Web AutoReplyRules (list + form + toggle) | ✅ | `apps/web/src/features/auto-reply/**` |
| Web Analytics (timeline chart + post insights detail) | ✅ | `apps/web/src/features/analytics/**` |
| Recharts dependency | ✅ | `apps/web/package.json` |

**Phase 6 polish — pending**:
- ⏳ BrandMention persist model — current stub không lưu match data
- ⏳ Real platform search (FB Graph deprecated, IG/TT need app review)
- ⏳ TikTok comment reply (Comment API limited)
- ⏳ IG + TT insight providers (currently throw `InsightFetchFailed`)
- ⏳ Insight backfill historical
- ⏳ Sentiment classification via apps/ai
- ⏳ Bulk action inbox (multi-select)
- ⏳ Push notification new comment

### Phase 7 — Polish + Launch ✅ (21/23 features per [ADR-0008](docs/decisions/0008-launch-readiness.md))

| Task | Status |
|---|---|
| F-701 Production Docker Compose stack + Dockerfile.prod (api/ai/web) | ✅ |
| F-702 Nginx + certbot + SSL renew | ✅ scaffold |
| F-703 Sentry SDK (apps/api, apps/ai, apps/web) | ✅ |
| F-704 Grafana + Prometheus + exporters | ✅ scaffold (cần wire `/metrics` cho apps/api ✅, apps/ai ⏳) |
| F-705 Postgres backup script → R2 + 30d retention | ✅ scaffold |
| F-706 Credits module (purchase/refund consumer + balance) | ✅ (14 tests) |
| F-707 Pricing page + Stripe Checkout UI | ✅ |
| F-708 Stripe webhook handler với signature verify | ✅ |
| F-709 Notification module (email + queue consumer) | ✅ |
| F-710 React Email templates (5 templates) | ✅ |
| F-711 Credential lifecycle scheduler (emit `credential.expiring`) | ✅ |
| F-712 Privacy + Terms + Data Deletion pages | ✅ |
| F-713 Data deletion endpoint (auth) | ✅ |
| F-714 App Review submission Meta + TikTok | ⏳ (runbook ready: [app-review-submission.md](docs/runbooks/app-review-submission.md)) |
| F-715 API key module + ApiKeyAuthGuard + scopes decorator | ✅ (12 tests + migration) |
| F-716 Multi-tenant workspace (Workspace + WorkspaceMember + role + JWT/header scope) | ✅ (24 tests + migration; 4 core models scoped; v2.1 mở rộng cho comment/auto-reply/brand-monitor/api-key) |
| F-717 Redlock distributed lock cho publish bundle | ✅ (12 tests) |
| F-718 Webhook DTO type-safe per-platform | ✅ (17 tests) |
| F-719 Smoke runbooks Phase 1-6 | ✅ docs ready, execute pending credentials |
| F-720 Landing page (marketing) | ✅ |
| F-721 Onboarding wizard 3 step | ✅ |
| F-722 Status page (`/status`) | ✅ |
| F-723 Launch checklist | ✅ |
| Public docs / help center | ⏳ |

> **Note F-719**: Smoke runbooks Phase 1-6 đã có đủ trong `docs/runbooks/`. Cần execute thật khi OAuth credentials + Meta/TikTok app review sẵn. Mỗi runbook có pre-req checklist + steps + cleanup + known issues. Final gate go-live: [docs/runbooks/launch-checklist.md](docs/runbooks/launch-checklist.md).

---

## Known issues / tech debt

| Issue | Severity | Plan |
|---|---|---|
| Type-check failing ~10 errors trong apps/api (DTO/JWT cast issue khi nestjs-zod resolve unknown) | Medium | Skip cho dev (`tsx watch` không stop), fix khi build prod. Có thể cần update nestjs-zod hoặc tự viết createZodDto |
| MinIO CORS chưa setup tự động qua compose | Low | Hook vào `minio-init` service hoặc document trong README |
| Webhook IG/TT chưa implement (chỉ FB) | Medium | Add khi pass platform App Review |
| Refresh token cho FB/IG (page tokens dài 60d nhưng vẫn cần re-auth) | Medium | Cron weekly reminder email user |
| AccountCard component không hiện cho extension mode (AUTOMATION) | Low | Cập nhật sau Phase 5 |
| AI image gen chưa có web UI | Low | Phase 4 polish |
| Calendar event không drag-drop reschedule được | Low | FullCalendar `editable: true` + handler `eventDrop` |

---

## Repo structure snapshot

```
sociflow/
├── apps/
│   ├── api/           NestJS — 15 core modules: agent, ai, auth, auto-reply,
│   │                  brand-monitor, comment, draft, health, insight, media,
│   │                  publish, social-account, user, webhook + cli
│   ├── ai/            NestJS — generation (caption + image), providers
│   ├── web/           Next.js 14 — 11 features: accounts, analytics, auth,
│   │                  auto-reply, calendar, compose, devices, drafts,
│   │                  inbox, media, publish
│   └── extension/     MV3 — popup pair + WS client + TT DOM stub
├── packages/
│   ├── common/        ResponseCode, AppException, zod helpers, decorators,
│   │                  filters, interceptor, pipes, crypto
│   ├── prisma/        schema + 6 migrations + service
│   ├── auth/          JwtStrategy, guards, SessionRepository, ContextModule
│   ├── queue/         BullMQ wrapper + CLS propagation
│   ├── oauth/         5 platform configs + OAuthService + state machine
│   ├── internal-client/ api↔ai client + InternalTokenGuard
│   ├── storage/       S3/R2 client + pre-signed URL
│   └── ws-protocol/   shared WS message schemas (server↔agent)
├── docs/
│   ├── 00-12          Architecture, data model, features, API, deployment
│   ├── decisions/     7 ADRs
│   ├── platforms/     YT/FB/IG/TT specs
│   └── runbooks/      smoke-test-phase1.md
├── .claude/
│   ├── rules/         project-standards, api-design, error-handling,
│   │                  coding-style, security, testing, git-workflow,
│   │                  frontend-architecture, cli-commands
│   ├── agents/        api-builder, platform-integrator, code-reviewer, ...
│   └── skills/        init-project, add-api-module, add-fe-feature,
│                      add-platform, setup-mcp-docs, sync-docs
├── .github/           ci.yml, security.yml, dependabot.yml, PR template
└── docker-compose.dev.yml + .env(.example) + README.md + CLAUDE.md
```

---

## Lines-of-code rough estimate

| Area | LOC ước tính |
|---|---|
| `packages/*` (8 packages) | ~3,400 |
| `apps/api` (Phase 6 BE: comment + auto-reply + brand-monitor + insight) | ~10,500 |
| `apps/ai` | ~700 |
| `apps/web` (Phase 6 web: inbox + auto-reply + analytics) | ~6,800 |
| `apps/extension` (Phase 5 client) | ~900 |
| `docs/` (markdown) | ~6,500 |
| `.claude/` (rules + agents + skills) | ~5,500 |
| **Total** | **~34,300** |

---

## Next session priorities

1. **Phase 7 launch** — Billing (Stripe checkout + plan tiers) + Onboarding wizard + Landing page + Production deploy (VPS + nginx + certbot + Docker prod) + Sentry/Grafana monitoring
2. **Fix type errors** ~10-15 trong `apps/api` để `pnpm build` prod pass — 30 phút work (createZodDto + JWT cast + `z.string().cuid()` zod v4 migration)
3. **Smoke test thực** — chốt OAuth credentials 5 platform (Google login + YT + FB + IG + TT) + verify e2e 1 post lên mỗi platform
4. **Phase 5 polish** — Real TikTok DOM selectors, Blob → DataTransfer file injection (CORS proxy via SW), Lexical caption editor synthetic events, redirect detect, anti-detection timing jitter
5. **Phase 6 polish** — IG + TT insight providers (need app review), TikTok Comment API, BrandMention persist model, sentiment classification via apps/ai
6. **Per-platform preview** trong ComposeView (FB/IG/TT/YT mockup card — UX critical)
7. **Settings page** (profile + API key + notification prefs)
8. **i18n** (next-intl) cho EN

---

## Conventions for updating this file

- **Khi đẩy 1 feature mới**: update bảng phase tương ứng + dấu ✅/🟡
- **Khi block**: thêm row vào "Known issues" với severity
- **Khi finish 1 phase**: update "Quick status" + `last_updated`
- **KHÔNG** xoá rows cũ — sociflow tracking là cumulative, dùng để retrospect
