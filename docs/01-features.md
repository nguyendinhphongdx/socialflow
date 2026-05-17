---
title: Features
description: Danh sách feature đầy đủ — MVP, V1, V2, Future
audience: [pm, developer, ai-agent]
---

# Features

Tổ chức theo **phase ship** thay vì theo module. Mỗi feature có:
- ID (`F-XXX`)
- Phase
- Module owner
- Acceptance criteria ngắn

## Phase 0 — Foundation (tháng 1)

Không user-facing. Setup nền móng.

| ID | Feature | Module | AC |
|---|---|---|---|
| F-001 | Monorepo Turborepo + pnpm workspaces | infra | `pnpm dev` chạy được api+web+ai |
| F-002 | Postgres + Prisma schema + migration tool | packages/prisma | `pnpm prisma migrate dev` |
| F-003 | Auth module: email/password + Google OAuth | packages/auth | Đăng ký + login web, JWT trả về |
| F-004 | Logger + global exception filter | packages/common | `AppException` ra response `{data, code, message}` |
| F-005 | Health check endpoint | apps/api | `GET /health` → `200 ok` |
| F-006 | Docker compose local: postgres + redis + minio (R2-compat) | infra | `docker compose up` lên đủ services |

## Phase 1 — Account + YouTube publish (tháng 2)

User connect tài khoản YouTube, đăng video qua API.

| ID | Feature | Module | AC |
|---|---|---|---|
| F-101 | Connect YouTube account qua OAuth 2.0 | apps/api/account | User click "Connect YouTube" → redirect Google → callback → account lưu DB với access/refresh token |
| F-102 | List connected accounts | apps/api/account | `GET /accounts` trả list account của user |
| F-103 | Upload video lên R2 với pre-signed URL | apps/api/media | Web upload trực tiếp lên R2 không qua backend |
| F-104 | Create publish task (immediate) | apps/api/publish | `POST /publish/create` → `PublishRecord` status DISPATCHED |
| F-105 | YouTube publish provider (resumable upload) | apps/api/publish/providers | Video lên thật YouTube, `dataId` + `workLink` lưu |
| F-106 | BullMQ + worker consumer immediate publish | packages/queue | Worker pick task → call provider → update status |
| F-107 | Publish records list page (web) | apps/web | Table show status, retry, view log |
| F-108 | OAuth token refresh tự động | packages/auth | Trước khi gọi API, check expiry → refresh nếu cần |

## Phase 2 — Multi-platform API (tháng 3)

Thêm FB, IG, TikTok qua OAuth.

| ID | Feature | Module | AC |
|---|---|---|---|
| F-201 | Facebook Page connect + publish (text + image + video + link) | apps/api | Đăng được Page post |
| F-202 | Instagram Business connect + publish (post + reel) | apps/api | Đăng được post + reel |
| F-203 | TikTok For Developers connect + Content Posting API | apps/api | Đăng video TikTok (cần app review) |
| F-204 | Multi-platform publish 1 click | apps/api/publish | 1 request → tạo N record cho N account, dispatch parallel |
| F-205 | Webhook handler: TikTok review status, FB feedback | apps/api/webhook | Nhận callback → update record status |
| F-206 | Account expiry warning (token sắp hết) | apps/api/account | Cron daily check, email/notify user |

## Phase 3 — UI complete + Scheduling (tháng 4)

Web UI hoàn chỉnh, calendar schedule, draft box.

| ID | Feature | Module | AC |
|---|---|---|---|
| F-301 | Calendar view (PC week + mobile month) | apps/web | Drag/drop post sang ngày khác → update publishTime |
| F-302 | Scheduled publish (future time) | apps/api | Scheduler tick mỗi 1 phút → pick task tới hạn → enqueue |
| F-303 | Compose post editor (text + media + per-platform options) | apps/web | Single editor, preview cho từng platform |
| F-304 | Draft box (lưu nháp) | apps/api + web | Save draft, load lại edit, duplicate |
| F-305 | Account groups (gom account theo client/brand) | apps/api | Group CRUD, filter post theo group |
| F-306 | Bulk publish (1 post → N account cùng platform) | apps/api/publish | Chọn nhiều account → tạo nhiều record |

## Phase 4 — AI Content (tháng 5)

AI gen text + image + video.

| ID | Feature | Module | AC |
|---|---|---|---|
| F-401 | AI text gen (caption, title, hashtag) | apps/ai | Prompt → OpenAI/Claude → text |
| F-402 | Adapt nội dung theo platform (length, tone, hashtag style) | apps/ai | 1 nội dung gốc → 4 variant cho 4 platform |
| F-403 | AI image gen (DALL-E 3 hoặc Flux qua Replicate) | apps/ai | Prompt → image URL R2 |
| F-404 | AI video gen (Veo 3 hoặc Seedance qua provider) | apps/ai | Prompt + ref image → video URL |
| F-405 | Batch generation (gen N variant 1 lần) | apps/ai | Queue job, progress streaming |
| F-406 | Credit/quota system (cap usage) | apps/api/credits | Mỗi user có quota tháng, AI call trừ credit |

## Phase 5 — Browser Extension (tháng 5-6, song song Phase 4)

Cài đặt được trên Chrome, đăng bài qua automation cho account không có OAuth.

| ID | Feature | Module | AC |
|---|---|---|---|
| F-501 | Chrome MV3 extension skeleton + pairing | apps/extension | User nhập pair code → kết nối WS |
| F-502 | WebSocket gateway (api ↔ extension) | apps/api/automation | Bi-directional, heartbeat, reconnect |
| F-503 | TikTok automation: upload video qua DOM | apps/extension | Mở tab tiktok.com/upload → fill form → submit |
| F-504 | Facebook automation: post text + image | apps/extension | Mở composer → submit |
| F-505 | Instagram automation: post + reel | apps/extension | DOM upload Instagram web |
| F-506 | YouTube automation: upload video | apps/extension | studio.youtube.com upload flow |
| F-507 | Per-account publishMode toggle (API/AUTOMATION/HYBRID) | apps/web | User chọn chế độ khi connect account |
| F-508 | Hybrid fallback: API fail → automation retry | apps/api/publish | Logic fallback trong dispatcher |
| F-509 | Extension status indicator (online/offline) | apps/web | UI thấy được agent có online không |
| F-510 | Selectors hot-update qua WS | apps/api/automation | Server push selector mới, extension không cần update |
| F-511 | Anti-detection: random delay, human-like timing | apps/extension | Delay 2-5s giữa actions |

## Phase 6 — Engage + Analytics (tháng 6)

Tương tác tự động + dashboard.

| ID | Feature | Module | AC |
|---|---|---|---|
| F-601 | Fetch comments từ FB/IG/YT qua API | apps/api/engagement | Cron mỗi 10 phút lấy comment mới |
| F-602 | AI auto-reply comment theo template/tone | apps/ai + apps/api | Comment vào → gen reply → submit (qua API hoặc automation) |
| F-603 | Brand mention monitoring (search keyword) | apps/api/engagement | User config keyword → notify khi xuất hiện |
| F-604 | Analytics dashboard (impressions, engagement, growth) | apps/web + apps/api | Daily snapshot, biểu đồ |
| F-605 | Per-post insights (FB Graph, YT Analytics, TT Analytics) | apps/api/analytics | Drill-down per post |
| F-606 | Revenue tracking (manual entry + brand deal log) | apps/api/revenue | User log brand deal, affiliate link tracker |

## Phase 7 — Polish + Launch (8 tuần — xem [ADR-0008](decisions/0008-launch-readiness.md))

Roadmap deterministic 8 tuần. Mỗi feature có DoD demoable.

### Infrastructure foundation (Tuần 1)

| ID | Feature | Module | AC |
|---|---|---|---|
| F-701 | Production Docker stack (api/ai/web/postgres/redis/nginx) | infra | `docker compose -f docker-compose.prod.yml up -d` chạy trên VPS |
| F-702 | HTTPS + auto SSL renew (nginx + certbot) | infra | `https://sociflow.io` valid cert, cron renew |
| F-703 | Error monitoring (Sentry) — FE + BE + AI service | infra | Trigger test error → capture trong Sentry dashboard |
| F-704 | Observability (Grafana + Prometheus) — queue depth, p95 latency, error rate | infra | Dashboard live, 3 alert rules configured |
| F-705 | Postgres backup daily → R2 + retention 30 ngày | infra | Backup script chạy cron, test restore thành công |

### Monetization (Tuần 2)

| ID | Feature | Module | AC |
|---|---|---|---|
| F-706 | Credits module (purchase/refund consumer + balance API) | apps/api/credits | `POST /credits/purchase` → Stripe Checkout → webhook grant credit |
| F-707 | Pricing page + plan tier (FREE/PRO/BUSINESS/ENTERPRISE) | apps/web | User subscribe Stripe Checkout, plan reflect trong UI |
| F-708 | Stripe webhook handler với signature verify | apps/api/webhook | Webhook idempotent, audit qua `WebhookEvent` table |

### Notification + lifecycle (Tuần 3-4)

| ID | Feature | Module | AC |
|---|---|---|---|
| F-709 | Notification module (email transactional + queue consumer) | apps/api/notification | Verify email + reset password + publish-failed alert hoạt động |
| F-710 | React Email templates (verify-email, reset-password, publish-failed, account-expired, credit-low) | packages/email | 5 template render với data prop, test SMTP |
| F-711 | Credential lifecycle state machine (ACTIVE → EXPIRING → EXPIRED → DISCONNECTED) | apps/api/social-account | Token sắp hết hạn → email alert + UI banner |

### App Review (Tuần 5 — parallel)

| ID | Feature | Module | AC |
|---|---|---|---|
| F-712 | Privacy policy + Terms of service page | apps/web | `/legal/privacy`, `/legal/terms` render full content |
| F-713 | Data Deletion endpoint (Meta requirement) | apps/api/auth | `POST /auth/data-deletion` triggers async user data purge |
| F-714 | Meta + TikTok App Review submission | infra/legal | Submit pending hoặc approved |

### API + multi-tenant (Tuần 6)

| ID | Feature | Module | AC |
|---|---|---|---|
| F-715 | API key module (CRUD + sha256 hash + 8-char prefix display) | apps/api/api-key | User tạo key, dùng `X-API-Key` header gọi `/publish` thành công |
| F-716 | Account group multi-tenant isolation (role OWNER/ADMIN/EDITOR/VIEWER) | apps/api + apps/web | Agency switch group, mỗi group có data isolated, role check |

### Concurrency + smoke (Tuần 7)

| ID | Feature | Module | AC |
|---|---|---|---|
| F-717 | Redlock distributed lock cho publish bundle | packages/common + apps/api/publish | Concurrent createBundle với cùng `idempotencyKey` chỉ tạo 1 bundle |
| F-718 | Webhook DTO type-safe per-platform (FB/IG/TT) | apps/api/webhook | Webhook payload validate qua zod schema per-source |
| F-719 | Smoke test runbooks Phase 2-6 đầy đủ | docs/runbooks | 5 runbook mới, mỗi cái có step-by-step với credentials thật |

### Onboarding + launch (Tuần 8)

| ID | Feature | Module | AC |
|---|---|---|---|
| F-720 | Landing page marketing (hero + features + pricing + testimonials) | apps/web | `/` render full, SEO metadata + OG image |
| F-721 | Onboarding wizard 3 step (connect account → compose → analytics) | apps/web | First-login user qua wizard, skip-able |
| F-722 | Status page `/status` (uptime + incident history) | apps/web hoặc external | Public status page reachable |
| F-723 | Launch checklist (5 runbook + backup restore + Sentry alert + Stripe live + App Review approved + load test) | infra/QA | Tất cả ✅ trong PR description |

## Future (V2+)

Backlog ý tưởng:

- 📱 Mobile app (React Native)
- 🇨🇳 Hỗ trợ Douyin/Xhs (nếu mở rộng sang TQ market)
- 💰 Marketplace creator ↔ brand (CPS/CPE/CPM model)
- 🤝 Multi-user / team workspace (collaboration)
- 🔌 API public + SDK cho developer
- 📺 Live stream tool
- 🛒 Shopee/Lazada link tracker
- 💬 Zalo OA integration
- 🎙️ Voice clone + dubbing video
- 🌐 SEO blog auto-generation
- 📊 Competitor analysis tool

## Feature flag strategy

Mỗi feature có thể disable bằng flag — config trong DB table `feature_flags`. Default OFF cho feature đang dev. AI agent **luôn implement với flag check**:

```ts
if (await this.featureFlag.isEnabled('F-405-batch-gen', userId)) {
  // ...
}
```

Lý do: ship sớm, enable theo cohort, rollback dễ.
