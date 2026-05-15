---
title: Roadmap
description: Kế hoạch 7.5 tháng từ skeleton tới launch
audience: [pm, developer, ai-agent]
---

# Roadmap

Solo dev, 7.5 tháng tổng. Mục tiêu: ship MVP có user trả tiền.

## Tổng quan timeline

```
Month  ├─ Foundation ─┤ YT publish │ Multi-plat │ UI complete │ AI gen │ Extension │ Engage+Analytics │ Polish + Launch
       │ M1           │ M1-2       │ M3         │ M3          │ M4     │ M4-5      │ M5-6             │ M6-7
Phase  │ P0           │ P1         │ P2         │ P3          │ P4     │ P5        │ P6               │ P7
Risk   │ low          │ med        │ high (TT)  │ med         │ low    │ very high │ med              │ low
```

## Phase 0 — Foundation (tuần 1-3 = ~M1 đầu)

Goal: monorepo + auth + DB chạy được, KHÔNG có feature user-facing

| Week | Task | DoD |
|---|---|---|
| 1 | Turborepo + pnpm workspaces + apps/api skeleton | `pnpm dev` chạy api, `/health` trả 200 |
| 1 | apps/web Next.js skeleton + shadcn install | `/` render được, theme dark/light switch |
| 1 | Postgres + Prisma schema initial (User, Session, ApiKey) | `prisma migrate dev` chạy được |
| 2 | Auth module: email/password, JWT, refresh token cookie | Đăng ký + login web hoạt động |
| 2 | Google OAuth login | "Sign in with Google" hoạt động |
| 2 | Global exception filter + AppException + ResponseCode | API trả `{data,code,message}` format |
| 3 | apps/ai skeleton + internal HTTP between api↔ai | api gọi `ai/health` thành công |
| 3 | Redis + BullMQ wrapper package | Test enqueue/process job |
| 3 | docker-compose.dev.yml hoàn chỉnh | `docker compose up -d` lên đủ deps |
| 3 | CI lint+type-check+test+build | PR có Actions chạy |

**Output**: skeleton repo deployable.

## Phase 1 — YouTube publish (tuần 4-7 = M1 cuối + M2 đầu)

Goal: user connect YouTube account, upload video, đăng được lên YT.

| Week | Task | DoD |
|---|---|---|
| 4 | SocialAccount schema + OAuth state machine | DB ready |
| 4 | YouTube OAuth flow (init → callback → save token) | User click "Connect YouTube" → done |
| 5 | Token refresh background + on-demand | Token expire tự renew |
| 5 | apps/web: account list page + connect button | UI hoạt động |
| 6 | Media upload qua pre-signed R2 URL | Web upload trực tiếp R2 |
| 6 | PublishRecord schema + publish.controller + service | API `POST /publish/create` tạo record |
| 7 | YouTubeProvider (videos.insert resumable upload) | Video lên YT thật, `workLink` lưu |
| 7 | BullMQ worker immediate.consumer.ts | Async dispatch, status update |
| 7 | Publish records list page | UI hiển thị thread |

**Risk**: YouTube quota daily 10K units, video upload = 1600 units → ~6 video/day free tier. Cần xin nâng quota.

**Demo milestone**: post `https://youtube.com/watch?v=XXX` từ web UI.

## Phase 2 — Facebook + Instagram + TikTok (M2 cuối + M3 đầu)

Goal: 4 platform chạy publish qua API.

| Week | Task |
|---|---|
| 8 | Đăng ký Meta Developer App, request `pages_manage_posts`, `pages_read_engagement` scope |
| 8 | Đăng ký TikTok For Developers app, request Content Posting API (chờ review 2-4 tuần) |
| 8 | FacebookProvider: page post (text + image + video + link) |
| 9 | InstagramProvider: post + reel (qua Meta Graph) |
| 9 | Multi-account connect UI (1 user connect nhiều FB pages, IG accounts) |
| 10 | TikTokProvider: upload video qua Content Posting API |
| 10 | Webhook handlers (TT review status, FB Page activity) |
| 11 | Bundle publish: 1 request → N record cho N account, parallel dispatch |
| 11 | Per-platform options validation (FB content_category, IG reel/post, TT privacy) |

**Risk**: TikTok app review có thể fail / kéo dài → có thể plan B dùng automation từ Phase 5 sớm.

**Demo milestone**: post 1 lần lên 4 platform.

## Phase 3 — UI complete (M3 cuối + M4 đầu)

Goal: web app dùng được như production.

| Week | Task |
|---|---|
| 12 | Compose post editor: text editor (lexical) + media gallery picker + per-platform tab |
| 12 | Preview per platform (FB/IG/TT/YT mockup) |
| 13 | Calendar view (FullCalendar) — list, drag-drop schedule |
| 13 | Scheduled publish flow (cron tick mỗi 1 phút) |
| 14 | Account groups CRUD + filter |
| 14 | Draft box: save, list, edit, duplicate, delete |
| 14 | Settings: profile, API key, notification preferences |
| 15 | i18n VN + EN (next-i18next) |
| 15 | Mobile responsive (Tailwind breakpoints) |

**Demo milestone**: Solo creator dùng được Sociflow thay Buffer.

## Phase 4 — AI content gen (M4 cuối + M5 đầu)

Goal: AI gen caption, image, video.

| Week | Task |
|---|---|
| 16 | apps/ai: chat module (OpenAI + Anthropic) |
| 16 | Caption generation API + UI (compose editor có "AI suggest" button) |
| 17 | Adapt content theo platform (1 nội dung → 4 variant) |
| 17 | Image generation (Replicate Flux Schnell) |
| 18 | Image gen UI: prompt + result gallery |
| 18 | Video generation (Replicate Seedance hoặc Veo qua proxy) |
| 19 | Credit system + AiJob tracking |
| 19 | Batch generation (N variant 1 request, queue) |

**Demo milestone**: 1-click "AI gen post" → có caption + ảnh sẵn sàng publish.

## Phase 5 — Browser extension (M5 cuối + M6 đầu, **song song Phase 4**)

Goal: extension Chrome đăng bài qua automation.

| Week | Task |
|---|---|
| 18 | apps/extension skeleton MV3 + manifest + esbuild build |
| 18 | apps/api/automation module: WS gateway + dispatcher + AutomationAgent CRUD |
| 19 | Pairing flow (6-digit code, agentToken, WS handshake) |
| 19 | Extension popup UI: status, pair, tasks list |
| 20 | TikTok content-script: upload video qua DOM (mất 1 tuần debug selector + anti-detect) |
| 20 | Facebook content-script: post text + image |
| 21 | Instagram content-script: post + reel |
| 21 | YouTube content-script: upload video qua studio.youtube.com |
| 22 | AutomationProvider tích hợp vào PublishDispatcher (route mode AUTOMATION → ws) |
| 22 | Hybrid fallback (API fail → automation retry) |
| 22 | Selectors hot-update qua WS |
| 23 | Anti-detection: human delay, typing simulation, error screenshot |
| 23 | Per-platform rate limit at agent |
| 23 | Extension Chrome Web Store publish (review 1-3 tuần) |

**Risk**: cao nhất phase này.
- TikTok DOM upload chống automation rất mạnh → có thể fail
- Chrome Web Store có thể reject (automation tools)
- → Plan B: side-load via developer mode, distribute qua website .crx download

**Demo milestone**: Đăng TikTok thành công qua extension trên account không có API.

## Phase 6 — Engagement + Analytics (M6 cuối)

Goal: auto-reply comment, dashboard analytics.

| Week | Task |
|---|---|
| 24 | Comment fetch cron (10 min) cho FB/IG/YT (TT qua extension) |
| 24 | Comment list page + filter (intent, sentiment) |
| 25 | AI reply generation + EngagementPolicy CRUD |
| 25 | Auto-reply modes (AI_AUTO / AI_DRAFT_HUMAN / HUMAN) |
| 26 | Brand keyword monitor + mention dashboard |
| 26 | Analytics: account insights cron (daily snapshot) |
| 26 | Per-post insights drill-down |
| 27 | Revenue tracking: manual brand deal log, affiliate link |

**Demo milestone**: AI auto-reply 100 comment/ngày cho 1 account.

## Phase 7 — Polish + Launch (M7)

Goal: production-ready, có user trả tiền.

| Week | Task |
|---|---|
| 28 | Billing: Stripe + VNPay subscription |
| 28 | Pricing page + free trial flow |
| 29 | Email notifications (Resend): publish success/fail, token expired, weekly digest |
| 29 | Onboarding flow: 3-step guide first time user |
| 30 | Sentry + Loki + Grafana setup |
| 30 | Landing page (marketing site) |
| 30 | Soft launch: 20 beta user invite từ FB group VN creator |
| 31 | Iterate based on feedback |
| 31 | Public launch announcement |

## Buffer & risk

Buffer 2 tuần phân bổ:
- Phase 2 (TikTok app review delay)
- Phase 5 (extension Web Store review)
- Phase 7 (production bugs)

## Cut scope khi trượt

Theo thứ tự (cut tệ nhất trước):
1. Phase 6 revenue tracking → V2
2. Phase 6 brand monitor → V2
3. Phase 4 video gen → V2 (giữ text + image)
4. Phase 5 extension cho YT (YT có API tốt rồi, ko cần automation gấp)
5. Phase 5 extension cho FB (FB Page API đủ)
6. → Còn cứng: YT/FB/IG/TT publish + AI text/image + TikTok extension

## Tracking

- Mỗi phase có **milestone Github**
- Mỗi feature có **issue + PR**
- Đầu tuần: review backlog + commit cho tuần
- Cuối phase: viết "Phase X retrospective" → ADR nếu có quyết định lớn

## Success criteria phase

| Phase | Criteria |
|---|---|
| P0 | Repo deployable, CI green |
| P1 | Post được lên YouTube từ web UI |
| P2 | Post 4 platform 1 click |
| P3 | UI đẹp dùng được như Buffer |
| P4 | AI gen caption + image hoạt động end-to-end |
| P5 | TikTok extension đăng bài thành công cho test account |
| P6 | Auto-reply comment hoạt động, analytics có biểu đồ |
| P7 | 20 beta user active, ≥1 user trả tiền |

## Hậu launch (V2 roadmap)

- Mobile app
- Team workspace (multi-user)
- Marketplace creator ↔ brand
- Zalo OA integration
- Public API + SDK
- Live stream tool
- Chinese platforms (nếu mở rộng)

## Tài liệu liên quan

- [01-features.md](01-features.md) — feature list chi tiết
- [00-overview.md](00-overview.md) — success metrics tổng
