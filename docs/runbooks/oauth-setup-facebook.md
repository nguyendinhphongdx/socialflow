---
title: OAuth Setup — Facebook (Meta for Developers)
description: Hướng dẫn tạo OAuth app để publish lên Facebook Page qua BYOK
audience: [end-user, agency-admin]
---

# Facebook OAuth Setup

> **Khi nào cần?** Workspace owner muốn dùng API mode publish Facebook Page (page post, ads insight, comment management). Setup này tách OAuth app riêng — không share với Sociflow Cloud.

## Pre-requisites

- Facebook account
- ≥1 Facebook Page bạn admin (cá nhân profile không publish API được)
- Business Verification recommended (cần cho production scope)

## Bước 1 — Tạo Meta app

1. Truy cập [developers.facebook.com/apps](https://developers.facebook.com/apps)
2. **Create App**
3. Use case: **Other** → **Next**
4. App type: **Business** → **Next**
5. App name: `Sociflow — {brand}` (visible trong OAuth consent)
6. Contact email + Business Account (skip nếu chưa có) → **Create App**

## Bước 2 — Add Products

Trong app dashboard:

1. **Facebook Login for Business** → Set Up
   - Settings → **Valid OAuth Redirect URIs**:
     ```
     https://sociflow.io/api/v1/social-accounts/facebook/callback
     ```
     (Copy từ Sociflow UI tương tự YT setup)
2. **Webhooks** (cho Phase 6 comment ingest):
   - Callback URL: `https://sociflow.io/api/v1/webhook/facebook`
   - Verify Token: copy từ Sociflow env `FACEBOOK_WEBHOOK_VERIFY_TOKEN`
   - Subscribe: `page` object → `feed`, `mentions`

## Bước 3 — Permissions & Features

App Review → **Permissions and Features**. Cần request:

**Standard access (auto-approved cho dev mode)**:
- `email`
- `public_profile`
- `pages_show_list`

**Advanced access (cần App Review — production)**:
- `pages_manage_posts` — publish bài lên Page
- `pages_read_engagement` — đọc comment, insight Page
- `pages_manage_engagement` — reply comment
- `business_management` — manage Business Manager assets
- `instagram_basic` (nếu connect cả IG)
- `instagram_content_publish` (nếu publish IG)
- `instagram_manage_comments`

## Bước 4 — Lấy Client ID + Secret

1. **Settings** → **Basic**
2. Copy **App ID** (= Client ID)
3. Copy **App Secret** (click Show — yêu cầu password)

## Bước 5 — Paste vào Sociflow

1. Settings → OAuth Credentials → Facebook → **Configure**
2. Paste App ID làm Client ID
3. Paste App Secret làm Client Secret
4. Redirect URI: pre-fill (đảm bảo match Step 2 Valid OAuth Redirect URIs)
5. Verify → Save

## Bước 6 — Test connection

1. `/dashboard/accounts/new` → Facebook → API mode
2. OAuth flow — sẽ hiển thị "Sociflow — {brand}" trong consent
3. Chọn Page(s) muốn quản lý → Authorize
4. Account connected — list Page hiển thị trong dashboard

## App Review process (production)

Trước khi user thật có thể login (không phải test user):

1. **App Review** → Submit request cho mỗi advanced scope
2. Required:
   - Privacy policy URL: `https://sociflow.io/legal/privacy`
   - Terms of service URL: `https://sociflow.io/legal/terms`
   - Data deletion URL: `https://sociflow.io/auth/data-deletion`
   - Demo video screencast (≤2 phút/scope) — show flow Sociflow dùng scope thực tế
   - Test user credentials cho reviewer
3. Submit → Meta review 2-7 business days
4. Khi approved → switch app từ **Development** → **Live mode**

Chi tiết: xem [app-review-submission.md](app-review-submission.md).

## Token rotation

- Short-lived user token: 1 giờ
- Long-lived user token: 60 ngày
- Page token (derive từ user token): 60 ngày
- Sociflow auto-refresh qua TokenRefreshScheduler

## Troubleshoot

### "App not active" / "Only test users"
- App đang Development mode → chỉ test user login được
- Submit App Review để go Live

### "Invalid scope"
- Check Step 3 đã add scope vào Permissions and Features
- Lúc chưa approved → chỉ available cho test user

### Redirect URI mismatch
- Bước 2 phải copy chính xác Redirect URI từ Sociflow

### Page không hiển thị
- User chưa Admin của Page → check Page Settings → Page Roles
- Hoặc Page bị restrict → check Page Status

## Security

- App Secret rotate qua: Settings → Basic → Reset
- Webhook signature verify (HMAC-SHA256 với app secret) đã có sẵn trong Sociflow

## References

- [ADR-0010 BYOK](../decisions/0010-byok-credentials.md)
- [Meta App Review docs](https://developers.facebook.com/docs/app-review/)
- [Facebook Login for Business](https://developers.facebook.com/docs/facebook-login)
- [Pages API](https://developers.facebook.com/docs/pages-api)
