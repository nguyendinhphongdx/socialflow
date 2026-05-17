---
title: Smoke test — Phase 2 (Facebook + Instagram publish)
description: Hướng dẫn kiểm chứng tay luồng publish multi-platform FB Page + IG Business sau Phase 2
audience: [developer]
---

# Smoke test — Phase 2 (FB + IG)

Verify luồng: connect Facebook Page → connect Instagram Business → upload media → bundle publish FB+IG → verify post lên thật + token refresh + cancel pending.

## Pre-requisites

1. **Meta App active** (App Review approved hoặc Test Users mode):
   - App ID + App Secret trong `.env`:
     ```
     FACEBOOK_OAUTH_CLIENT_ID=xxx
     FACEBOOK_OAUTH_CLIENT_SECRET=xxx
     INSTAGRAM_OAUTH_CLIENT_ID=xxx        # thường giống FB App
     INSTAGRAM_OAUTH_CLIENT_SECRET=xxx
     META_WEBHOOK_VERIFY_TOKEN=any-random-string
     META_APP_SECRET=xxx                  # cho HMAC verify webhook
     ```
   - Scope cần grant: `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`.
   - Authorized redirect URIs:
     - `http://127.0.0.1:3000/api/v1/social-accounts/facebook/callback`
     - `http://127.0.0.1:3000/api/v1/social-accounts/instagram/callback`
   - Detail [docs/platforms/facebook.md](../platforms/facebook.md) + [docs/platforms/instagram.md](../platforms/instagram.md).

2. **Test Facebook Page + IG Business Account**:
   - Tạo Page test (loại "Business").
   - Link IG Business Account (Settings → Linked accounts) → IG account phải là Business hoặc Creator (không Personal).
   - Add chính user vào "Roles" để có quyền publish.

3. **MinIO public read** (như Phase 1 — Meta cần fetch media URL public):
   ```bash
   docker exec -it sociflow-minio-init-1 sh -c 'mc anonymous set download local/sociflow-dev'
   ```

4. Docker stack chạy + `pnpm dev` đã start (3 service: api / ai / web).

5. Đã có user authenticated (login qua [smoke-test-phase1.md](smoke-test-phase1.md) bước 2-3).

## Steps

### 1. Connect Facebook Page

Web: <http://localhost:3020/dashboard/accounts> → click **+ Connect Facebook**
→ Meta consent screen → grant all scopes → callback.

Nếu có nhiều Page, system tạo 1 `SocialAccount` row mỗi Page (xem `FacebookConnectService.persistPages`).

Verify DB:
```bash
docker exec -it sociflow-postgres psql -U sociflow -d sociflow_dev -c "
SELECT id, platform, status, \"displayName\", \"externalId\" AS page_id,
       LENGTH(\"accessToken\") AS token_len,
       \"tokenExpiresAt\"
FROM \"SocialAccount\" WHERE platform = 'FACEBOOK';
"
```
- `token_len` > 100 → encrypted.
- `tokenExpiresAt` ~60 ngày sau (long-lived page token).
- `externalId` = Facebook Page ID.

### 2. Connect Instagram Business

Trên cùng dashboard → click **+ Connect Instagram** → grant scopes.

System sẽ:
- List Pages user manage
- Filter Page có IG Business Account linked
- Tạo `SocialAccount` row với `platform = 'INSTAGRAM'`, `metadata.fbPageId`, `metadata.igBusinessId`.

Verify:
```bash
docker exec -it sociflow-postgres psql -U sociflow -d sociflow_dev -c "
SELECT \"displayName\", \"externalId\", metadata
FROM \"SocialAccount\" WHERE platform = 'INSTAGRAM';
"
```

### 3. Upload media

Web: <http://localhost:3020/dashboard/compose>:
- Click vùng uploader → chọn 1 ảnh JPG (< 8MB) + 1 video MP4 (< 100MB)
- Verify upload progress 0 → 100% (XHR `PUT` lên MinIO trực tiếp)
- Verify `POST /media/confirm` được gọi → MediaAsset row created với `width`, `height`, `duration` đã probe

Debug nếu fail:
```bash
docker exec -it sociflow-postgres psql -U sociflow -d sociflow_dev -c "
SELECT id, type, \"mimeType\", width, height, duration, \"publicUrl\"
FROM \"MediaAsset\" ORDER BY \"createdAt\" DESC LIMIT 5;
"
```

### 4. Bundle publish FB + IG

Compose view:
- Multi-select **2 account**: FB Page + IG Business
- Title (FB only — IG bỏ qua title): `Smoke phase 2`
- Body: `Test cross-platform publish Sociflow 🚀`
- Drop 1 ảnh từ Media Library
- Schedule: **Publish ngay**
- Click **Publish**

System tạo 1 PublishBundle + 2 PublishRecord (FB + IG) cùng `flowId`.

Verify ngay:
```bash
docker exec -it sociflow-postgres psql -U sociflow -d sociflow_dev -c "
SELECT id, \"flowId\", platform, status, stage, \"platformPostId\", \"workLink\"
FROM \"PublishRecord\" ORDER BY \"createdAt\" DESC LIMIT 5;
"
```

Wait ~10-30s → cả 2 record chuyển `PENDING → DISPATCHED → IN_PROGRESS → PUBLISHED`.

- **FB**: `workLink` dạng `https://facebook.com/<pageId>_<postId>` → click → post hiện trên Page.
- **IG**: 2-step container API (POST `/media` create container → POST `/media_publish`) — `workLink` dạng `https://instagram.com/p/<shortcode>`.

### 5. Cancel pending publish

Tạo 1 publish schedule **30 phút sau**:
- Compose → chọn FB only → Schedule "Sau 30 phút" → Publish

Verify status `SCHEDULED` (chưa enqueue).

Web: <http://localhost:3020/dashboard/publish> → click record pending → **Cancel**.

Verify:
```bash
docker exec -it sociflow-postgres psql -U sociflow -d sociflow_dev -c "
SELECT id, status, \"cancelledAt\" FROM \"PublishRecord\" WHERE status = 'CANCELLED';
"
```

`cancelledAt` được set. BullMQ delayed job phải bị remove (verify `KEYS bull:publish-scheduled:delayed`).

### 6. Token refresh test

Manual expire FB token:
```sql
UPDATE "SocialAccount"
SET "tokenExpiresAt" = NOW() + INTERVAL '4 minutes'
WHERE platform = 'FACEBOOK';
```

`TokenRefreshScheduler` chạy cron mỗi 5 phút, threshold 10 phút trước expiry → quét → enqueue `token-refresh` job → `FacebookProvider.refreshLongLivedToken` được gọi.

Watch log api:
```bash
docker logs -f $(docker ps --filter name=api --format '{{.ID}}') 2>&1 | grep -i 'refresh'
```

Sau ~5 phút thấy: `Refreshed token for FACEBOOK account <id>` + `tokenExpiresAt` mới ~60 ngày sau.

Nếu IG token expire: re-auth flow bắt buộc (Meta không cho refresh IG token độc lập). Verify error `AccountReauthRequired` trả về khi publish.

### 7. Verify webhook ingest (smoke check)

Simulate FB webhook payload:
```bash
TS=$(date +%s)
BODY='{"object":"page","entry":[{"id":"PAGE_ID","time":1700000000,"changes":[{"field":"feed","value":{"item":"comment","verb":"add","comment_id":"123_456","message":"smoke comment","from":{"id":"USER_ID","name":"Test"}}}]}]}'
SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$META_APP_SECRET" -hex | awk '{print "sha256="$2}')

curl -X POST http://localhost:3000/api/v1/webhook/facebook \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: $SIG" \
  --data "$BODY"
```

Expect: `{ "ok": true }` 200 + `WebhookEvent` row created. Phase 6 sẽ test deep ingest.

## Cleanup

```bash
docker exec -it sociflow-postgres psql -U sociflow -d sociflow_dev -c "
TRUNCATE \"PublishRecord\", \"PublishBundle\", \"MediaAsset\",
         \"SocialAccount\", \"OAuthState\", \"WebhookEvent\" CASCADE;
"

docker exec -it sociflow-redis redis-cli FLUSHDB
```

Optional: xoá FB test posts manual qua Page (Meta không cho API delete batch).

## Known issues

### "Page access token invalid" lúc publish FB
- Token có thể bị Meta revoke sau khi user đổi password / 2FA.
- Verify scope grant đủ: phải có `pages_manage_posts`.
- Re-connect Page qua flow OAuth.

### IG `media_publish` trả "The user is not an Instagram Business" 
- IG account phải là **Business** hoặc **Creator**, không Personal.
- IG phải linked với FB Page (Settings → Accounts Center).

### Webhook 403 "Invalid signature"
- `META_APP_SECRET` sai hoặc empty.
- Body có thể bị JSON-stringify lại trước verify → check `apps/api/src/main.ts` raw body capture.

### Token refresh không chạy
- Verify scheduler đăng ký: log `Scheduling token refresh cron 5m`.
- Verify cron expression `*/5 * * * *` trong `TokenRefreshScheduler`.
- Check Redis `KEYS bull:token-refresh:*`.

## Next

→ [smoke-test-phase3.md](smoke-test-phase3.md) — Calendar + Draft + Scheduled
