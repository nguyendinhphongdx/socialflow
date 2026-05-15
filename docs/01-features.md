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

## Phase 7 — Polish + Launch (cuối tháng 6 / đầu tháng 7)

| ID | Feature | Module | AC |
|---|---|---|---|
| F-701 | i18n VN + EN | apps/web | Switch ngôn ngữ, mọi text qua `t()` |
| F-702 | Pricing page + billing (Stripe / VNPay) | apps/web + apps/api | User subscribe plan |
| F-703 | Email notification (publish success/fail, account expire) | apps/api | Resend hoặc SES |
| F-704 | Error monitoring (Sentry) | infra | Frontend + backend error tracked |
| F-705 | Production deploy (VPS + nginx + SSL) | infra | aitoearn.vn hoặc sociflow.io chạy |
| F-706 | Landing page + onboarding | apps/web | Welcome flow guide user qua 3 step đầu |

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
