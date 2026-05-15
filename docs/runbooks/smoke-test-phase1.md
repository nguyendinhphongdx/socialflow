---
title: Smoke test — Phase 1 (auth → connect YT → upload → publish)
description: Hướng dẫn kiểm chứng tay luồng publish end-to-end sau khi finish Phase 1
audience: [developer]
---

# Smoke test — Phase 1

Verify luồng: register → login → connect YouTube → upload video → POST /publish → video lên YouTube thật.

## Pre-requisites

1. **Google Cloud OAuth credentials** — tạo trên <https://console.cloud.google.com>:
   - Create OAuth 2.0 Client (Web application)
   - Authorized redirect URIs:
     - `http://127.0.0.1:3000/api/v1/auth/google/callback`
     - `http://127.0.0.1:3000/api/v1/social-accounts/youtube/callback`
   - Lấy `Client ID` + `Client Secret` → paste vào `.env`:
     ```
     GOOGLE_OAUTH_CLIENT_ID=xxx.apps.googleusercontent.com
     GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-xxx
     YOUTUBE_OAUTH_CLIENT_ID=xxx.apps.googleusercontent.com
     YOUTUBE_OAUTH_CLIENT_SECRET=GOCSPX-xxx
     ```
   - Bật **YouTube Data API v3** trên project Google Cloud.
   - Bật **OAuth consent screen** — set scopes `youtube.upload`, `youtube.readonly`, `youtube.force-ssl`, `openid`, `email`, `profile`.
   - Add bản thân vào "Test users" để bypass app review.

2. **MinIO bucket public read + CORS**:
   ```bash
   # Mở MinIO console http://localhost:9001 (minio / minio12345)
   # → Bucket "sociflow-dev" → Access policy → Public read
   # → Bucket "sociflow-dev" → CORS → Add rule:
   #   AllowedOrigin: http://localhost:3020, http://127.0.0.1:3020
   #   AllowedMethod: PUT, GET, HEAD
   #   AllowedHeader: *
   ```

   Hoặc qua `mc` CLI:
   ```bash
   docker exec -it sociflow-minio-init-1 sh -c '
   mc anonymous set download local/sociflow-dev
   '
   ```

3. Docker stack chạy: `docker compose -f docker-compose.dev.yml ps` đủ 4 service (postgres, redis, mailhog, minio) healthy.

## Steps

### 1. Start dev servers

```bash
pnpm dev
```

Verify:
- API: <http://localhost:3000/api/v1/health/live> → `{ status: 'ok' }`
- AI: <http://localhost:3001/api/v1/health> → `{ status: 'ok' }`
- Web: <http://localhost:3020/> → landing page

### 2. Register

POST `http://localhost:3000/api/v1/auth/register`:
```json
{ "email": "test@sociflow.local", "password": "test1234", "name": "Test" }
```

Kết quả: response có `user` + `tokens`, cookie `sf_access` + `sf_refresh` được set.

### 3. Login via Google (alternative)

Mở browser: <http://localhost:3000/api/v1/auth/google>
→ redirect tới Google consent → grant → callback → redirect về <http://localhost:3020/dashboard>.

Verify cookie `sf_access` httpOnly, path `/`.

### 4. Connect YouTube channel

Web: <http://localhost:3020/dashboard/accounts> → click **+ Connect YouTube**
→ Google consent → grant scopes → callback → redirect về `/dashboard/accounts?connected=...`
→ Account hiển thị status **ACTIVE**, platform **YOUTUBE**.

Verify DB:
```bash
docker exec -it sociflow-postgres psql -U sociflow -d sociflow_dev -c "
SELECT id, platform, status, \"displayName\", LENGTH(\"accessToken\") AS token_len
FROM \"SocialAccount\";
"
```
`token_len` > 50 → đã encrypt AES-256-GCM.

### 5. Upload video + publish

Web: <http://localhost:3020/dashboard/compose>:
- Chọn account YouTube
- Title: `Smoke test video`
- Body: `Test publish từ Sociflow`
- Drop file video mp4 < 5MB vào uploader
- Click **Publish ngay**

Verify:
- Redirect tới `/dashboard/publish`
- Record hiển thị status `PENDING` → `DISPATCHED` → `IN_PROGRESS` → `PUBLISHED` (auto-refresh 5s)
- `workLink` xuất hiện → click → video lên YouTube channel

Debug nếu fail:
```bash
# Check publish record state
docker exec -it sociflow-postgres psql -U sociflow -d sociflow_dev -c "
SELECT id, status, stage, \"errorMessage\", \"platformPostId\", \"workLink\", \"retryCount\"
FROM \"PublishRecord\" ORDER BY \"createdAt\" DESC LIMIT 5;
"

# Check BullMQ queue
docker exec -it sociflow-redis redis-cli -n 0
> KEYS bull:publish-immediate:*
> LRANGE bull:publish-immediate:wait 0 -1
```

### 6. Token refresh

Wait 15 min hoặc chỉnh `tokenExpiresAt` thủ công:
```sql
UPDATE "SocialAccount" SET "tokenExpiresAt" = NOW() + INTERVAL '5 minutes';
```

Cron `TokenRefreshScheduler` chạy mỗi 5 phút → quét → enqueue → consumer refresh.

Verify log api có dòng `Refreshed token for YT account ...`. Sau đó `tokenExpiresAt` được update với giá trị mới (1 tiếng sau).

## Known issues

### MinIO PUT 403 hoặc CORS error

→ MinIO chưa cấu hình CORS. Mở console, set như mục pre-requisite.

### YouTube 401 / 403 lúc upload

- Check `accessToken` đã decrypt đúng (worker log `decryptAccessToken success`)
- Check scope grant đủ — phải có `youtube.upload`
- Check video file MIME thực = `video/mp4`/`quicktime`/`webm`

### Type errors khi chạy `pnpm dev`

- `tsx watch` chỉ log warning không stop. Code chạy được khi JS-level valid.
- Khi cần build prod (`pnpm build`) thì phải fix hết.

## Cleanup

```bash
# Clear DB
docker exec -it sociflow-postgres psql -U sociflow -d sociflow_dev -c "
TRUNCATE \"PublishRecord\", \"MediaAsset\", \"SocialAccount\", \"OAuthState\", \"Session\", \"User\" CASCADE;
"

# Clear MinIO
docker exec -it sociflow-minio-init-1 sh -c '
mc rm --recursive --force local/sociflow-dev/uploads/
'

# Clear Redis queues
docker exec -it sociflow-redis redis-cli FLUSHDB
```
