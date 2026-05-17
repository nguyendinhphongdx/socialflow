---
title: OAuth Setup — Instagram (Meta Business)
description: Hướng dẫn tạo OAuth app để publish lên Instagram Business qua BYOK
audience: [end-user, agency-admin]
---

# Instagram OAuth Setup

> **Khi nào cần?** Workspace muốn publish IG post + reel qua API. IG dùng chung Meta app với Facebook — nếu đã setup [Facebook](oauth-setup-facebook.md) thì chỉ cần activate IG products.

## Pre-requisites

- ✅ Đã setup Facebook OAuth app theo [oauth-setup-facebook.md](oauth-setup-facebook.md)
- ✅ Instagram **Business Account** hoặc **Creator Account** (không phải personal — quan trọng)
- ✅ IG account linked với 1 Facebook Page (yêu cầu Meta để API access)

## Bước 1 — Convert IG sang Business/Creator

Nếu IG đang Personal:

1. IG app → Settings → Account → **Switch to Professional Account**
2. Chọn **Business** (creator cũng work cho hầu hết feature)
3. Link với Facebook Page (theo prompt)

## Bước 2 — Link IG với FB Page

1. Facebook Page → Settings → **Linked Accounts** → Instagram
2. Click Connect → login IG Business account
3. Verify connected

## Bước 3 — Add Instagram products vào Meta app

Trong Meta app dashboard (cùng app với Facebook):

1. Sidebar → **Add Product** → **Instagram Graph API** → Set Up
2. Sidebar → **Instagram Basic Display** (nếu chỉ cần read) → Set Up

## Bước 4 — Permissions

Trong **App Review** → **Permissions and Features**:

**Required cho publish**:
- `instagram_basic` — IG profile basic info
- `instagram_content_publish` — tạo IG post/reel
- `instagram_manage_comments` — đọc + reply IG comment
- `instagram_manage_insights` — analytics
- `pages_show_list` (đã có từ FB setup)
- `business_management`

Submit App Review tương tự FB (xem [oauth-setup-facebook.md Step 4](oauth-setup-facebook.md#bước-4--lấy-client-id--secret)).

## Bước 5 — Webhook (optional, cho real-time comment)

1. Meta app → Webhooks → Subscribe **instagram** object
2. Callback URL: `https://sociflow.io/api/v1/webhook/instagram` (dùng chung handler với FB)
3. Verify token: từ env `FACEBOOK_WEBHOOK_VERIFY_TOKEN`
4. Subscribe fields: `comments`, `mentions`

## Bước 6 — Paste vào Sociflow

Dùng **CÙNG Client ID + Client Secret** từ Facebook (1 Meta app cover cả 2 platform):

1. Sociflow Settings → OAuth Credentials → **Instagram**
2. Bật toggle "Dùng chung Meta app với Facebook" → auto-fill từ FB credential
3. Hoặc paste manually nếu muốn tách app
4. Verify → Save

## Bước 7 — Connect IG account

1. `/dashboard/accounts/new` → Instagram → API mode
2. OAuth flow:
   - Login FB account
   - Chọn FB Page linked với IG
   - Sociflow sẽ tự detect IG Business Account linked
3. Account connected

## Quirks & limitations

- **Reel upload max 90s** (post bình thường max 60s với feed)
- **Story KHÔNG support qua Graph API** — phải dùng AUTOMATION mode
- **Carousel max 10 ảnh**
- **Hashtag**: max 30
- **Tag user**: max 20
- Container expires sau **1 giờ** — phải publish trong window này

## API container flow

IG post flow (khác YT/FB):

```
1. POST /{ig-user-id}/media (tạo container với image/video URL)
   → return container_id (lifespan 1h)
2. POST /{ig-user-id}/media_publish (publish container)
   → return media_id
3. GET /{media-id} (read post metadata)
```

Sociflow handle full flow trong `instagram.provider.ts` — user không cần care detail.

## Insight scopes (cho Phase 6 Analytics)

Cần `instagram_manage_insights`:
- Followers count
- Post reach, impressions, engagement
- Reel views

→ Sociflow IG insight provider (`apps/api/src/core/insight/providers/instagram-insight.provider.ts`) đã implement.

## Troubleshoot

### "User does not have permission"
- IG account chưa Business/Creator → Step 1
- Chưa link FB Page → Step 2

### "Media container expired"
- Container `/media` sống 1 giờ, phải `/media_publish` trong window
- Sociflow retry policy đã handle 1 retry

### "Aspect ratio invalid"
- IG feed: 1:1 (1080x1080) hoặc 4:5 (1080x1350)
- Reel: 9:16 (1080x1920)
- Sociflow chưa validate aspect — sẽ fail ở API call. Phase 4 polish add pre-validate.

## References

- [ADR-0010 BYOK](../decisions/0010-byok-credentials.md)
- [Instagram Graph API](https://developers.facebook.com/docs/instagram-api)
- [Content Publishing](https://developers.facebook.com/docs/instagram-api/guides/content-publishing)
- [oauth-setup-facebook.md](oauth-setup-facebook.md) — IG dùng chung Meta app
