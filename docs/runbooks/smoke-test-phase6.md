---
title: Smoke test — Phase 6 (Engagement + Analytics)
description: Verify webhook comment ingest, auto-reply, brand monitor, insight snapshot, analytics dashboard
audience: [developer]
---

# Smoke test — Phase 6 (Engagement + Analytics)

Verify: webhook FB comment ingest → emit event → AutoReplyRule match → reply submit; brand monitor scheduler enqueue; insight snapshot tạo row; analytics dashboard render chart.

## Pre-requisites

1. Pass [smoke-test-phase2.md](smoke-test-phase2.md) — có FB Page + IG account active với scopes `pages_read_engagement`, `instagram_manage_comments`.

2. Đã có ít nhất 1 PublishRecord status `PUBLISHED` với `platformPostId` (cần làm Phase 2 trước).

3. `META_APP_SECRET` trong `.env` cho HMAC verify webhook.

4. `pnpm dev` running.

## Steps

### 1. Simulate webhook comment ingest

POST giả webhook FB:

```bash
BODY='{
  "object":"page",
  "entry":[{
    "id":"YOUR_PAGE_ID",
    "time":1700000000,
    "changes":[{
      "field":"feed",
      "value":{
        "item":"comment",
        "verb":"add",
        "post_id":"YOUR_PAGE_ID_YOUR_POST_ID",
        "comment_id":"123456789",
        "message":"Awesome product! Where to buy?",
        "from":{"id":"USER_123","name":"Jane Doe"},
        "created_time":1700000000
      }
    }]
  }]
}'

SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$META_APP_SECRET" -hex | awk '{print "sha256="$2}')

curl -X POST http://localhost:3000/api/v1/webhook/facebook \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: $SIG" \
  --data "$BODY" -v
```

Expect: 200 `{ "ok": true }`.

Replace `YOUR_PAGE_ID` và `YOUR_POST_ID` với thật từ DB:
```sql
SELECT "externalId" FROM "SocialAccount" WHERE platform = 'FACEBOOK';
SELECT "platformPostId" FROM "PublishRecord" WHERE platform = 'FACEBOOK' AND status = 'PUBLISHED';
```

### 2. Verify Comment row + event emit

```bash
docker exec -it sociflow-postgres psql -U sociflow -d sociflow_dev -c "
SELECT id, platform, \"externalId\" AS comment_id, content, status, \"authorName\", \"publishRecordId\"
FROM \"Comment\" ORDER BY \"createdAt\" DESC LIMIT 5;
"
```

- 1 row mới với `content = 'Awesome product! Where to buy?'`
- `status = 'NEW'`
- `externalId = '123456789'`

Idempotency: chạy lại curl với cùng `comment_id` → KHÔNG tạo row mới (`unique(platform, externalId)`).

Verify event `comment.new` emit (log apps/api):
```
[CommentService] comment.new emitted { commentId, platform: 'FACEBOOK' }
```

### 3. AutoReplyRule match + dispatch

Web: <http://localhost:3020/dashboard/auto-reply> → **+ New rule**:
- Name: `Smoke FB buy intent`
- Account: FB Page connected
- Match keywords (any): `buy, where to buy, mua, giá`
- Reply template: `Cảm ơn bạn quan tâm! DM mình để được tư vấn giá nhé 💛`
- Daily quota: 10
- Status: enabled

Save → giờ ingest 1 webhook khác:
```bash
# Repeat curl step 1 với comment_id khác + message="Em muốn mua, giá bao nhiêu?"
```

`AutoReplyProcessor` (@OnEvent `comment.new`):
- Filter rules theo `accountId` + enabled
- Match keywords → hit `buy`
- Atomic check quota (Redis INCR with TTL EOD) — pass
- Enqueue `auto-reply` queue với delay 30-120s (jitter chống detection)
- Consumer call `FacebookCommentProvider.reply(comment.externalId, template)` → Graph API

Wait ~2 phút → verify:
```sql
SELECT c.id, c.status, c."replyContent", c."repliedAt"
FROM "Comment" c WHERE "replyContent" IS NOT NULL ORDER BY c."createdAt" DESC LIMIT 5;
```

`status = 'REPLIED'`, `replyContent` set.

Verify trên FB Page comment: thấy reply mới.

### 4. Quota exhausted path

Set quota:
```sql
UPDATE "AutoReplyRule" SET "dailyQuota" = 1 WHERE id = '<ruleId>';
```

Ingest 2 webhook khác matching → chỉ 1 reply, comment 2 status = `QUOTA_EXCEEDED` (skip reply).

Verify atomic counter:
```bash
docker exec -it sociflow-redis redis-cli GET "autoreply:quota:<ruleId>:2026-05-17"
```
`= 1`, TTL ~24h.

### 5. Brand monitor

Web: <http://localhost:3020/dashboard/brand-monitor> → **+ New monitor**:
- Name: `Sociflow brand`
- Keywords: `sociflow, sosi flow`
- Platforms: FB + IG + TikTok (TT stub)
- Frequency: 10 phút (đã setup cron)

Save → wait 10 phút HOẶC manual trigger:
```bash
docker exec -it sociflow-redis redis-cli XADD "brand-monitor-trigger" "*" monitorId "<id>"
```

`BrandMonitorScheduler` → enqueue `brand-monitor-scan` job → consumer call platform search.

Verify:
- Log: `[BrandMonitorConsumer] scanning brand <id> with keywords ['sociflow', 'sosi flow']`
- Stub search providers trả 0 hoặc fixture results

> ⚠️ Hiện tại: `BrandMention` model chưa persist (xem PROGRESS Phase 6 polish pending). Verify job CHẠY, không verify data lưu.

### 6. Insight snapshot manual trigger

Có PublishRecord `PUBLISHED` rồi → trigger snapshot:

```bash
# Manual enqueue post-snapshot job
docker exec -it sociflow-redis redis-cli LPUSH "bull:insight-snapshot:wait" \
  '{"name":"snapshot","data":{"publishRecordId":"<id>"}}'
```

Hoặc đợi cron 6h auto-fire.

Consumer call `InsightService.snapshotPostInsight(recordId)`:
- Gọi `FacebookInsightProvider.fetch` hoặc YT
- INSERT `PostInsight` row với likes/comments/shares/views snapshot

Verify:
```sql
SELECT "publishRecordId", platform, likes, comments, shares, views, "snapshotAt"
FROM "PostInsight" ORDER BY "snapshotAt" DESC LIMIT 5;
```

### 7. Account daily rollup

Manual trigger account rollup (cron 1AM):
```bash
docker exec -it sociflow-redis redis-cli LPUSH "bull:insight-rollup:wait" \
  '{"name":"rollup","data":{"accountId":"<id>","date":"2026-05-17"}}'
```

Verify:
```sql
SELECT "accountId", date, "totalLikes", "totalComments", "totalShares", "totalViews", "followerCount"
FROM "AccountInsight" ORDER BY date DESC LIMIT 5;
```

### 8. Analytics dashboard render

Web: <http://localhost:3020/dashboard/analytics>:
- Default tab Timeline → chart Recharts 30 days
- Verify chart render (cần ít nhất 1 data point)
- Switch tab "By post" → list PublishRecord PUBLISHED với mini-insight row
- Click row → modal/page chi tiết với likes/comments/shares timeline

Verify network tab:
- `GET /insight/timeline?range=30d` returns 200 với array data point.
- `GET /insight/post/:id` returns latest snapshot.

### 9. Inbox view

Web: <http://localhost:3020/dashboard/inbox>:
- Filter all comments status `NEW`, `REPLIED`, `IGNORED`
- Click 1 comment → side panel → manual reply / mark ignore / delete
- Verify state update + API call.

## Cleanup

```bash
docker exec -it sociflow-postgres psql -U sociflow -d sociflow_dev -c "
TRUNCATE \"Comment\", \"AutoReplyRule\", \"BrandMonitor\",
         \"PostInsight\", \"AccountInsight\", \"WebhookEvent\" CASCADE;
"
docker exec -it sociflow-redis redis-cli --scan --pattern 'autoreply:*' | xargs -r docker exec -i sociflow-redis redis-cli DEL
```

## Known issues

### Webhook HMAC fail
- `META_APP_SECRET` empty hoặc sai.
- Raw body parser (express raw) phải apply trước `body-parser.json` cho route `/webhook/*`.

### `comment.new` event không fire
- Verify `EventEmitter2` injection.
- `AutoReplyProcessor` phải có `@OnEvent('comment.new')`.

### Reply API trả 200 nhưng comment không thấy trên FB
- Token scope thiếu `pages_manage_engagement`.
- Comment đã bị Meta filter spam → check rate limit user.

### Insight provider throw `InsightFetchFailed`
- IG insight require app review approved cho `instagram_manage_insights`.
- YT analytics quota khác YT data API quota.

### Chart hiện rỗng
- Cần ≥1 PostInsight row. Re-trigger snapshot.
- Recharts skip null point — kiểm tra null vs 0.

## Next

→ [launch-checklist.md](launch-checklist.md) — Final gate trước go-live
