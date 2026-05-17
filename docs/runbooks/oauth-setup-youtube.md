---
title: OAuth Setup — YouTube (Google Cloud Console)
description: Hướng dẫn tạo OAuth app để dùng API mode publish YouTube qua BYOK
audience: [end-user, agency-admin]
---

# YouTube OAuth Setup

> **Khi nào cần?** Khi bạn muốn dùng API mode để upload video YouTube tự động (thay vì Browser Automation). Setup này dành cho **workspace owner/admin** để tạo OAuth app riêng — không share quota với user khác.

## Pre-requisites

- Google Account (cá nhân hoặc Google Workspace)
- 1 channel YouTube đã tồn tại để test
- Quota giới hạn: 10.000 units/ngày free tier (~6 video upload/ngày)

## Bước 1 — Tạo Google Cloud project

1. Truy cập [console.cloud.google.com](https://console.cloud.google.com)
2. Click dropdown project (top-left) → **New Project**
3. Name: vd `sociflow-byok-{tên-brand}`
4. Click **Create**, chờ ~30s
5. Đảm bảo project mới được select ở dropdown

## Bước 2 — Enable YouTube Data API v3

1. Sidebar trái → **APIs & Services** → **Library**
2. Search "YouTube Data API v3"
3. Click vào card → **Enable**
4. Đợi 1-2 phút API activate

## Bước 3 — OAuth consent screen

1. **APIs & Services** → **OAuth consent screen**
2. User Type: chọn **External** (cho phép Google account bất kỳ login) → **Create**
3. Điền:
   - App name: `Sociflow — {brand của bạn}` (sẽ hiển thị trên OAuth consent)
   - User support email: email của bạn
   - App logo (optional)
   - App domain: `sociflow.io` (hoặc domain self-host)
   - Authorized domains: `sociflow.io`
   - Developer contact: email
4. **Save and Continue**
5. Scopes — Click **Add or Remove Scopes**:
   - `https://www.googleapis.com/auth/youtube.upload`
   - `https://www.googleapis.com/auth/youtube.readonly`
   - `https://www.googleapis.com/auth/youtube.force-ssl` (cần để delete/edit video)
   - Confirm → **Save and Continue**
6. Test users — Add email của bạn + 1-2 collaborator (lúc chưa publish chỉ test user truy cập được)
7. **Save and Continue** → review → **Back to Dashboard**

## Bước 4 — Create OAuth Client ID

1. **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: `Sociflow Web OAuth — {brand}`
5. **Authorized JavaScript origins**:
   - `https://sociflow.io` (production)
   - `http://localhost:3010` (dev — optional)
6. **Authorized redirect URIs** — **QUAN TRỌNG, copy từ Sociflow**:

   Trong Sociflow UI: Settings → OAuth Credentials → YouTube → Configure → copy "Redirect URI" hiển thị. Format:

   ```
   https://sociflow.io/api/v1/social-accounts/youtube/callback
   ```

   (Hoặc dev: `http://localhost:3000/api/v1/social-accounts/youtube/callback`)

7. **Create**
8. Popup hiện **Client ID** + **Client Secret** — copy 2 giá trị này

## Bước 5 — Paste vào Sociflow

1. Settings → OAuth Credentials → YouTube → **Configure**
2. Paste **Client ID**
3. Paste **Client Secret**
4. Redirect URI: đã pre-fill (chính URI ở Bước 4.6)
5. Scopes: để default (Sociflow tự fill các scope từ Bước 3.5)
6. Click **Verify** — Sociflow sẽ dry-run OAuth init để test config
7. Nếu OK → **Save**

## Bước 6 — Connect YouTube account

1. `/dashboard/accounts/new`
2. Chọn YouTube → API mode
3. Click **Connect via OAuth**
4. Google consent screen mở ra — sẽ hiển thị **tên app của bạn từ Bước 3.3** (white-label ✅)
5. Click **Continue** → cho phép các scopes
6. Redirect về Sociflow — account connected!

## Quota & limitation

| Item | Default | Max (request quota increase) |
|---|---|---|
| Daily quota | 10.000 units | 1.000.000 units |
| Video upload | 1.600 units/video | — |
| Daily upload limit | ~6 video | Unlimited với quota tăng |
| List/read | 1-3 units/call | — |

→ Request tăng quota: `Google Cloud Console → IAM & Admin → Quotas`. Lý do điền "Production launch — content creator platform serving X users".

## Troubleshoot

### Error "redirect_uri_mismatch"
- Redirect URI ở Sociflow + Google Cloud Console phải **GIỐNG HỆT** (case-sensitive, trailing slash matters)
- Check protocol `https://` vs `http://`

### Error "access_denied" / consent screen rejected
- App chưa publish → chỉ test user (email thêm ở Bước 3.6) login được
- Hoặc submit app verification để remove test user limit

### "Quota exceeded"
- Check `console.cloud.google.com/iam-admin/quotas?service=youtube.googleapis.com`
- Request quota increase hoặc chuyển sang AUTOMATION mode cho dài hạn

### Token expired sau 7 ngày
- Free tier OAuth token expire 1 tuần nếu app chưa verified
- Verify app: submit app cho Google review (1-4 tuần) → unlimited refresh

## Security note

- Client Secret = quan trọng. Anyone có Client Secret + Client ID → có thể impersonate app của bạn
- Sociflow encrypt Client Secret AES-256-GCM trong DB
- Nếu nghi ngờ leak: Google Cloud Console → Credentials → click app → **Reset secret** → update Sociflow

## References

- [ADR-0010 BYOK](../decisions/0010-byok-credentials.md)
- [YouTube Data API v3 docs](https://developers.google.com/youtube/v3/getting-started)
- [Google OAuth 2.0 docs](https://developers.google.com/identity/protocols/oauth2)
