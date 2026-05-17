---
title: App Review Submission Runbook
description: Quy trình submit Meta + TikTok App Review để unlock OAuth scopes
audience: [founder, ops]
---

# App Review Submission

> Trạng thái: ⏳ pending (F-714 — Tuần 5 trong [ADR-0008](../decisions/0008-launch-readiness.md))

## Meta (Facebook + Instagram)

### Scopes cần xin review

| Scope | Mục đích | Bắt buộc cho feature |
|---|---|---|
| `pages_show_list` | List pages user manage | F-201 connect FB Page |
| `pages_manage_posts` | Tạo post Page | F-201 publish FB |
| `pages_read_engagement` | Đọc comment + insight | F-601 comment ingest, F-605 insight |
| `instagram_basic` | IG profile basic | F-202 IG connect |
| `instagram_content_publish` | Tạo IG post/reel | F-202 IG publish |
| `instagram_manage_comments` | Đọc + reply IG comment | F-602 auto-reply IG |
| `business_management` | Manage business account | F-305 account groups |
| `pages_messaging` (optional v2) | DM auto-reply | Future |

### Checklist trước submit

- [ ] Privacy Policy public ở `https://sociflow.io/legal/privacy` (F-712)
- [ ] Terms of Service ở `https://sociflow.io/legal/terms` (F-712)
- [ ] Data Deletion endpoint hoạt động ở `https://sociflow.io/auth/data-deletion` (F-713)
- [ ] Demo video screencast ≤ 2 phút cho mỗi scope (Meta requirement)
- [ ] Test user FB Page + IG Business Account active
- [ ] Production app domain verified trong Facebook Developer Console
- [ ] HTTPS valid cert
- [ ] App icon 1024x1024 PNG
- [ ] OAuth redirect URI: `https://sociflow.io/api/v1/auth/facebook/callback`

### Demo video script per scope

**`pages_manage_posts`** (60-90s):
1. (10s) Login Sociflow web với test user
2. (15s) Click "Connect Facebook Page" → OAuth → grant page permission
3. (20s) Quay sang compose: title + body + 1 image, chọn FB page, click Publish
4. (15s) Show post xuất hiện trên Facebook Page test
5. (10s) Show entry trong `/dashboard/publish` với status PUBLISHED

**`pages_read_engagement`** (60s):
1. (10s) Sociflow inbox view comments fetched từ test page
2. (20s) Demo webhook receive comment real-time
3. (15s) Filter comments by sentiment/status
4. (15s) Show analytics dashboard với engagement metrics

**`instagram_content_publish`** (90s):
1. Similar flow nhưng IG account
2. Cover both post + reel
3. Show carousel multi-image

### Submission flow

1. Truy cập [Facebook Developer Console](https://developers.facebook.com/apps)
2. App Settings → App Review → Permissions and Features
3. Request mỗi scope:
   - Notes: link tới demo video YouTube unlisted
   - "How will your app use this permission" — viết theo template dưới
4. Submit → wait 2-7 business days typically

### Template "How will your app use"

```
Sociflow is a social media management SaaS for Vietnamese content creators
and agencies. The "<scope_name>" permission is used to:

- Allow users to publish content to their connected Facebook Pages from
  Sociflow's compose interface (no human-readable UI changes outside of
  Sociflow itself).
- Content is initiated by the user, not the app — every publish action
  requires the user to click "Publish" in the Sociflow UI.
- Published content is plain user-created text + images/videos uploaded
  by the user to Cloudflare R2 storage, then sent to Facebook via Graph
  API endpoint /me/feed or /<page_id>/feed.
- No spam or automated mass-posting — rate limited to 30 posts/user/hour.

User benefit: Save time by composing once and publishing to Facebook
along with other social platforms (Instagram, TikTok, YouTube).
```

### Rejection handling

Common rejection reasons + fix:
- "Privacy policy doesn't address data retention" → update `legal/privacy.md`
- "Demo video missing scope X usage" → re-record + resubmit chỉ scope đó
- "Test user couldn't access flow" → check test user role, verify domain whitelist

## TikTok For Developers

### API cần review

- **Content Posting API** + **Direct Post** scope — Phase 1 cần
- **Research API** (optional) — F-601 comment sync (Phase 6)

### Checklist trước submit

- [ ] App registered tại [TikTok for Developers](https://developers.tiktok.com/)
- [ ] Privacy Policy + ToS như Meta
- [ ] Demo video upload TikTok video qua API
- [ ] Production domain verified
- [ ] OAuth redirect: `https://sociflow.io/api/v1/auth/tiktok/callback`
- [ ] Justification document (xem dưới)

### Justification template

```
Application: Sociflow — Social Media Management Platform
Use case: Cross-platform content publishing for creators/agencies

Why we need Content Posting API:
1. Our users manage multiple TikTok accounts as part of their content strategy
2. They want to schedule and publish videos via Sociflow's unified compose
3. We use Direct Post (not draft) because users prefer one-step publish

Volume estimate: ~500 posts/day initially, scaling to ~5,000/day at 6 months
Privacy: We do not store TikTok video content beyond temporary upload buffer
Compliance: Rate limiting at 30 posts/user/hour, signature verification
all webhooks, encrypted token storage AES-256-GCM
```

### Review timeline

- Initial review: 2-4 weeks (TikTok longer than Meta)
- Often needs back-and-forth — budget 6 weeks total
- **Fallback**: nếu review fail/delay → user dùng Extension automation Phase 5 (DOM)

## Tracking trong PROGRESS.md

Cập nhật `PROGRESS.md` khi:
- Submit Meta App Review → mark `🟡 in-review`
- Approve → mark `✅`
- Reject → note reason + re-submit ETA

## References

- [Meta App Review docs](https://developers.facebook.com/docs/app-review/)
- [TikTok app review](https://developers.tiktok.com/doc/getting-started-create-an-app)
- [F-714 in 01-features.md](../01-features.md#tuần-5-app-review-submission-parallel)
- [Privacy policy template — F-712](../legal/privacy.md)
