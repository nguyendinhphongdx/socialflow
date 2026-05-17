---
title: ADR-0008 Launch readiness roadmap — 8 tuần
status: accepted
date: 2026-05-17
deciders: [founder]
---

# ADR-0008 — Launch readiness roadmap (8 tuần)

## Status

Accepted.

## Context

Sau Phase 0-6 scaffold + Wave 1-3 fix (security/layering/tests, 64 file changed, 66 tests pass), repo về mặt kỹ thuật **type-check + lint + build + tests xanh**. Tuy nhiên đối chiếu với:

1. **Definition of Done mức 3** ([definition-of-done.md](../definition-of-done.md)) — Phase done yêu cầu manual smoke test với credentials thật, runbook đầy đủ, security checklist, observability.
2. **AiToEarn reference repo thật** ([yikart/AiToEarn](https://github.com/yikart/AiToEarn)) — đối thủ proven có sẵn các module mà Sociflow CHƯA có:
   - `credits` purchase/refund consumer (monetization thật)
   - `notification` module độc lập (email transactional + queue)
   - `credential-invalidation` state machine
   - `api-key` module
   - `account-group` multi-tenant isolation
   - `redlock` distributed lock
   - Webhook DTO type-safe per-platform
3. **PROGRESS.md Phase 7** ⏳ — billing, deploy, monitoring, onboarding, landing chưa làm.

Cần roadmap **deterministic 8 tuần** để launch MVP có user trả tiền.

## Decision

Roadmap 8 tuần theo sequence dưới đây. Mỗi tuần có **DoD demoable** (kiểm tra được bằng command/UI). Bỏ qua nice-to-have, tập trung BLOCKER + HIGH.

### Tuần 1: Infrastructure foundation

DoD: `docker compose -f docker-compose.prod.yml up -d` lên đủ services trên VPS, HTTPS hoạt động, Sentry capture được test error.

- Production `docker-compose.prod.yml` (api, ai, web, postgres, redis, nginx)
- Nginx config + certbot SSL renew cron
- Sentry SDK wire vào `apps/api`, `apps/ai`, `apps/web` (`SENTRY_DSN` env)
- Grafana + Prometheus minimal: queue depth, response time p95, error rate
- Postgres backup script daily → R2 + retention 30 ngày
- Domain DNS + reverse proxy

### Tuần 2: Credits + billing (Stripe)

DoD: User mua plan qua Stripe Checkout → webhook → credit grant → có thể gọi AI. Refund qua admin → credit revoke.

Module mới `apps/api/src/core/credits/`:
- `credits.service.ts` — grant/decrement/refund
- `credits-purchase.consumer.ts` — Stripe webhook → grant
- `credits-refund.consumer.ts` — dispute → revoke
- `credits.controller.ts` — `/credits/balance`, `/credits/history`
- `credits.repository.ts` + Prisma migration `CreditTransaction` table
- Plan tier: FREE / PRO / BUSINESS / ENTERPRISE (DB enum đã có)
- Stripe webhook handler trong `webhook.controller.ts` với signature verify

### Tuần 3: Notification module + email transactional

DoD: User register → nhận verify email. Post failed → user nhận alert email. Password reset link gửi qua email TTL 15p.

Module mới `apps/api/src/core/notification/`:
- `notification.service.ts` — orchestrate (email/push/in-app)
- `email.service.ts` — wrap Resend/SES
- `notification.consumer.ts` — BullMQ queue process
- Template: `verify-email`, `reset-password`, `publish-failed`, `account-expired`, `credit-low`
- React Email templates trong `packages/email/` (mới)
- `@OnEvent('publish.failed')` listener → enqueue email job

### Tuần 4: Credential lifecycle + alert

DoD: Token FB/IG sắp hết hạn (3 ngày trước expiry) → user nhận email. Token expired thật → account move sang `TOKEN_EXPIRED` status, hiển thị banner web "Reconnect required". Publish khi token expired → fail nhanh + alert.

- `credential-invalidation.service.ts` trong `social-account/`
- Token state machine: `ACTIVE → EXPIRING_SOON → TOKEN_EXPIRED → DISCONNECTED`
- Cron daily check expiry < 3 days → emit `credential.expiring` event
- Auto-reply consumer + publish consumer check token state trước khi exec

### Tuần 5: App Review submission (parallel với tuần 3-4)

DoD: Submit Meta App Review (đã được approve hoặc đang under review). TikTok For Developers Content Posting API đã submit.

- Meta: scopes `pages_manage_posts`, `pages_read_engagement`, `instagram_content_publish`, `business_management`
- TikTok: Content Posting API + Direct Post scope
- Privacy policy + Terms of service page (`/legal/privacy`, `/legal/terms`)
- Data Deletion endpoint (Meta requirement): `/auth/data-deletion`
- Demo video recording cho App Review

### Tuần 6: API key module + multi-tenant cleanup

DoD: User tạo API key qua `/settings/api-keys`, dùng key gọi `/api/v1/publish` qua header `X-API-Key`. Agency switch giữa account groups, mỗi group isolated.

Module mới `apps/api/src/core/api-key/`:
- `api-key.service.ts` — generate (sha256 hash + 8-char prefix display)
- `api-key.controller.ts` — CRUD + revoke
- `ApiKeyStrategy` Passport + guard
- Rate limit per-key tách biệt user

Refactor `account-group`:
- Tenant boundary: mọi query Service layer filter `groupId` nếu user trong context group
- Group switcher trong web header
- Role per group: `OWNER / ADMIN / EDITOR / VIEWER`

### Tuần 7: Redlock + webhook DTO refactor + smoke runbooks

DoD: Publish bundle concurrent từ 2 tab không tạo duplicate. Webhook FB/IG/TT có DTO type-safe. Runbook smoke test có cho mỗi platform.

- `packages/common/redlock.ts` — wrapper `redlock@5` lib
- `PublishService.createBundle` acquire lock theo `idempotencyKey` 30s
- Webhook refactor:
  - `webhook.dto.ts` chia thành `facebook-webhook.dto.ts`, `instagram-webhook.dto.ts`, `tiktok-webhook.dto.ts`
  - `WebhookService.handle*` dispatch theo source với DTO typed
- `docs/runbooks/`:
  - `smoke-test-phase2.md` (FB + IG publish)
  - `smoke-test-phase3.md` (Calendar + draft)
  - `smoke-test-phase4.md` (AI gen)
  - `smoke-test-phase5.md` (Extension TT)
  - `smoke-test-phase6.md` (Comment auto-reply + analytics)

### Tuần 8: Onboarding + landing + launch checklist

DoD: User mới vào `sociflow.io` → landing → signup → onboarding wizard 3 step (connect first account, compose first post, view first analytics). Status page `/status` hoạt động.

- Landing page `/` (marketing): hero, features, pricing, testimonials
- Onboarding wizard `/onboarding` qua 3 step (skip-able)
- Status page Cachet hoặc UptimeRobot embed
- Launch checklist:
  - [ ] All 5 smoke runbooks pass
  - [ ] Backup restore test (xóa DB → restore từ R2)
  - [ ] Sentry alert hoạt động (trigger test error)
  - [ ] Stripe live mode bật
  - [ ] App Review approved (Meta + TT)
  - [ ] Rate limit verified với load test (k6)

## Alternatives considered

| Option | Pros | Cons | Vì sao loại |
|---|---|---|---|
| Launch sớm với scope nhỏ hơn (4 tuần) | Time-to-market nhanh | Thiếu billing → không monetize, thiếu notification → UX kém | Không sustainable |
| Launch chậm 12 tuần với feature đầy đủ AiToEarn | Parity với competitor | Cash burn cao, không validate sớm | Solo dev không kham |
| Copy nguyên module AiToEarn (port MongoDB → Postgres) | Tiết kiệm design | Nx vs Turborepo khác, code Chinese-specific (Aliyun) cần rewrite nhiều | Cost cao hơn redesign |

## Consequences

### Positive

- Roadmap deterministic — mỗi tuần có DoD đo được
- Ưu tiên monetize từ tuần 2 (revenue-first)
- Defer marketplace / multi-tenant đầy đủ / Chinese platforms → sau Product-Market Fit
- Reuse pattern proven từ AiToEarn (credits consumer, notification module, credential lifecycle)

### Negative

- 8 tuần ngắn cho solo dev — risk overrun
- App Review (Meta + TT) ngoài kiểm soát, có thể fail/delay
- Không có buffer cho bug discovery — tuần 1-2 phải clean

### Mitigation

- **Risk overrun**: mỗi tuần có Friday review, slip 1 tuần OK; slip 2+ tuần phải cut scope (drop tuần 7 redlock+webhook refactor)
- **App Review delay**: Submit sớm (tuần 2-3), fallback plan dùng Extension automation Phase 5 cho user không qua được OAuth review
- **Bug discovery**: Tests Wave 2 đã cover core paths. Smoke runbook tuần 7 sẽ flush UI/integration bugs

## References

- [definition-of-done.md](../definition-of-done.md) — DoD mức 3 (Phase done)
- [01-features.md](../01-features.md#phase-7--polish--launch) — F-701 đến F-706 (sẽ mở rộng thành F-701..F-712)
- [PROGRESS.md](../../PROGRESS.md) — current state Phase 0-6 ✅, Phase 7 ⏳
- [AiToEarn repo](https://github.com/yikart/AiToEarn) — reference module structure
- [ADR-0003](0003-chrome-extension-only.md) — lý do không có Electron desktop
- [ADR-0004](0004-split-api-ai-services.md) — pattern split api/ai
