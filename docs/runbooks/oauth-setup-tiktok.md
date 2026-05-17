---
title: OAuth Setup — TikTok (Content Posting API)
description: Hướng dẫn tạo OAuth app TikTok hoặc dùng Automation mode để bypass App Review
audience: [end-user, agency-admin]
---

# TikTok OAuth Setup

> **⚠️ Quan trọng:** TikTok Content Posting API yêu cầu **App Review** (2-6 tuần). Pre-review, video upload chỉ được **SELF_ONLY** (private). Khuyến nghị: **dùng AUTOMATION mode** (Browser Extension) cho TikTok đến khi review pass.

## Quyết định: API vs Automation cho TikTok

| Aspect | API mode | Automation mode (Recommended pre-review) |
|---|---|---|
| Setup time | App Review 2-6 tuần | Install extension 5 phút |
| Privacy | Pre-review: SELF_ONLY only | Tự do (như user post tay) |
| Reliability | High (official API) | Medium (DOM có thể đổi) |
| Speed | < 30s | 1-3 phút |
| Quota | Theo API rate limit | Không (user browser session) |
| Cost | Free | Free |

→ **Nếu bạn solo creator chưa qua review**: chọn AUTOMATION → [skip xuống section Automation](#tiktok-automation-mode)

→ **Nếu agency đã pass App Review hoặc willing wait**: tiếp tục API setup dưới.

## TikTok API mode setup

### Pre-requisites

- TikTok creator account
- Willing đợi 2-6 tuần App Review
- Privacy policy + ToS public
- Demo video screencast

### Bước 1 — Đăng ký TikTok For Developers

1. Truy cập [developers.tiktok.com](https://developers.tiktok.com)
2. Login với TikTok account
3. **Manage Apps** → **Connect an App**

### Bước 2 — Create app

1. **App Name**: `Sociflow — {brand}`
2. **App Description**: "Social media management platform — multi-platform content publishing for Vietnamese creators"
3. **Category**: Content Creation Tools
4. **App Icon**: 1024x1024 PNG

### Bước 3 — Add products

Trong app dashboard:

**Login Kit** (basic OAuth):
- Redirect URI: copy từ Sociflow Settings → OAuth Credentials → TikTok
  ```
  https://sociflow.io/api/v1/social-accounts/tiktok/callback
  ```

**Content Posting API** (Direct Post):
- Scopes needed:
  - `user.info.basic` — profile (auto-approved)
  - `video.publish` — **CẦN App Review**
  - `video.list` — read uploaded video (auto-approved)
  - `video.upload` (Direct Post) — **CẦN App Review**

**Research API** (optional — cho Phase 6 comment ingest):
- `research.adlib.basic` — search content public (**CẦN review riêng**)

### Bước 4 — Submit App Review

App Review → Submit:

1. **Scopes**: select `video.publish` + `video.upload`
2. **Justification** template:

   ```
   Sociflow is a SaaS platform for Vietnamese content creators and agencies
   to manage social media content across YouTube, Facebook, Instagram, and
   TikTok in a unified interface.

   Use case for video.publish + video.upload:
   - Users compose video content in Sociflow's editor (custom title, hashtags,
     privacy settings, comment/duet/stitch toggles)
   - User clicks "Publish" — Sociflow uploads to user's connected TikTok account
   - User-initiated only (no batch automation; one publish action per user click)
   - Rate limited to 30 posts/user/hour at Sociflow side
   - Volume estimate: ~500 publishes/day initially, scaling to ~5K/day at 6 months

   Privacy: Sociflow does not store video content beyond temporary R2 upload
   buffer. Tokens encrypted AES-256-GCM at rest.

   Compliance: Privacy policy at sociflow.io/legal/privacy, Terms at /legal/terms,
   Data Deletion at /auth/data-deletion (Meta-style endpoint).
   ```

3. **Demo video**: screencast user click Publish → video xuất hiện TikTok (2 phút)
4. Submit → TikTok review **2-6 tuần** (typically 3 weeks)

### Bước 5 — Lấy Client Key + Secret

App dashboard → **Basic Information**:
- Copy **Client Key** (= Client ID)
- Copy **Client Secret**

### Bước 6 — Paste vào Sociflow

1. Settings → OAuth Credentials → TikTok → Configure
2. Paste Client Key + Client Secret
3. Redirect URI: pre-fill (đảm bảo match Step 3)
4. Verify → Save

### Bước 7 — Connect TikTok account

Lúc chưa review pass:
1. `/dashboard/accounts/new` → TikTok → API mode
2. OAuth flow OK với user login
3. Publish thử → video upload với privacy `SELF_ONLY` (private trên TT)
4. Verify trong TikTok app — video xuất hiện trong Drafts/Private

Sau App Review approve:
- Auto upgrade — publish PUBLIC OK

## TikTok Automation mode

> **Recommended cho user mới** — bỏ qua API setup hoàn toàn.

### Bước 1 — Install Sociflow extension

1. `/dashboard/devices` → Click **Install Extension**
2. Chrome Web Store link (hoặc dev: load unpacked từ `apps/extension/dist`)
3. Pin extension vào toolbar

### Bước 2 — Pair extension

1. Extension popup → "Get pair code"
2. Sociflow `/dashboard/devices` → **Pair New Device** → nhập 6-digit code → Confirm
3. Extension status: ✅ Connected

### Bước 3 — Login TikTok trong browser

1. Mở tab tiktok.com → Login user account (giữ tab open)
2. Hoặc: extension sẽ detect khi bạn login lần đầu

### Bước 4 — Connect TT account vào Sociflow

1. `/dashboard/accounts/new` → TikTok → **Automation mode**
2. Sociflow gửi extension command "detect-me"
3. Extension đọc DOM TikTok → trả về username + uid
4. Account connected với `publishMode: 'AUTOMATION'`

### Bước 5 — Test publish

1. `/dashboard/compose` → upload video + caption
2. Chọn TT account → click Publish
3. Extension mở tab `tiktok.com/upload` (hoặc reuse tab existing)
4. Fill form: caption, privacy, hashtags
5. Submit
6. Verify trên TikTok account — video appear

### Automation limitations

- **Browser phải mở** lúc publish (hoặc dùng pinned extension trong background — vẫn cần Chrome chạy)
- **DOM selector** có thể outdated khi TT update UI → Sociflow push selector update qua WS `s2a:selectors-update`
- **No batch upload** — publish 1-by-1 với delay 2-5s
- **Captcha rare nhưng có** — extension report fail, user manual confirm

## Hybrid mode (sau App Review)

Khi đã pass review, switch sang HYBRID:
- API mode primary (faster, no browser needed)
- Automation fallback nếu API fail (rare — content policy reject, rate limit)

Edit account: `/dashboard/accounts/{id}` → Mode → **Hybrid** → Save.

## Troubleshoot

### API mode: "unaudited_client_can_only_post_to_private_accounts"
- App chưa review pass → video privacy forced SELF_ONLY
- Workaround tạm: dùng AUTOMATION mode
- Hoặc đợi App Review

### Automation: "Selector not found"
- TT đã update DOM → check `/dashboard/settings/extension-agents` → "Update selectors"
- Sociflow admin push new selectors qua WS → restart extension

### Automation: "Tab navigation timeout"
- TT redirect anti-bot detection → wait 30s, retry
- Hoặc bật "Slow mode" trong extension settings (delay 5-10s mỗi action)

### Both modes: "Login required"
- Cookie expired → re-login TikTok trong browser
- Hoặc: TT detect bot → wait 24h trước khi retry

## Phase 5/6 polish status

- ✅ Provider code complete (api + automation)
- ✅ Pair flow + WS
- ✅ Insight provider (Research API)
- ⚠️ Real DOM selectors pending (current là placeholder)
- ⚠️ App Review submission pending (F-714)

## References

- [ADR-0010 BYOK](../decisions/0010-byok-credentials.md)
- [TikTok For Developers](https://developers.tiktok.com/)
- [Content Posting API](https://developers.tiktok.com/doc/content-posting-api-get-started)
- [Login Kit](https://developers.tiktok.com/doc/login-kit-web)
- [app-review-submission.md](app-review-submission.md) — F-714 details
