---
title: Smoke test — Phase 4 (AI content gen + credits)
description: Verify AI caption gen, image gen, credit deduct, insufficient flow, Stripe top-up
audience: [developer]
---

# Smoke test — Phase 4 (AI gen)

Verify: AI caption multi-provider happy path, credit decrement, InsufficientCredits, image gen, multi-platform adapt, Stripe checkout (test mode) → grant credit → AI lại OK.

## Pre-requisites

1. **AI provider keys** trong `.env` của `apps/ai`:
   ```
   OPENAI_API_KEY=sk-xxx
   ANTHROPIC_API_KEY=sk-ant-xxx          # optional, nếu chọn provider claude
   AI_DEFAULT_PROVIDER=openai            # hoặc anthropic
   AI_CAPTION_MODEL=gpt-4o-mini
   AI_IMAGE_MODEL=dall-e-3
   ```

2. **Internal token** giữa api ↔ ai:
   ```
   INTERNAL_API_TOKEN=any-shared-secret
   ```
   Verify cả `apps/api/.env` và `apps/ai/.env` cùng value.

3. **Stripe test mode** (optional cho step 6):
   ```
   STRIPE_SECRET_KEY=sk_test_xxx
   STRIPE_WEBHOOK_SECRET=whsec_xxx
   STRIPE_PRICE_CREDITS_100=price_xxx    # tạo trên Stripe Dashboard
   ```
   - Stripe CLI: `stripe listen --forward-to http://localhost:3000/api/v1/webhook/stripe`

4. `pnpm dev` running (api + ai + web).

5. User logged in với `aiCredits = 5` (default từ seed). Verify:
   ```sql
   SELECT id, email, "aiCredits", "planTier" FROM "User";
   ```

## Steps

### 1. AI caption happy path

Web: <http://localhost:3020/dashboard/compose>:
- Title: bỏ trống
- Body: empty
- Click **AI Assist** button (✨ icon)
- Popover mở → fields:
  - Topic: `Ra mắt sản phẩm mới`
  - Tone: `friendly`
  - Platform: `facebook`
  - Include hashtags: ✅
- Click **Generate**

Loading ~3-8s → response insert vào body field.

Verify response shape:
```bash
# Trong DevTools network tab — POST /ai/caption
# Response: { code: 0, data: { content: "...", tokensUsed: N } }
```

Verify credit decrement:
```sql
SELECT "aiCredits" FROM "User" WHERE id = '<userId>';
```
Phải `5 → 4`.

Verify log apps/ai có:
```
[GenerationService] caption request received { provider: 'openai', model: 'gpt-4o-mini' }
[GenerationService] caption response OK { tokensUsed: 234 }
```

### 2. Multi-platform adapt

Sau khi có 1 caption "base", click **Adapt to other platforms**:
- 1 caption Facebook → variants cho `instagram` + `tiktok` + `youtube`
- Mỗi platform 1 credit (4 total).

Verify:
- 4 variant hiển thị tabs trong UI.
- `aiCredits` giảm 4 (từ 4 → 0).

> Nếu chưa có UI: gọi API trực tiếp `POST /ai/adapt` với body `{ source: '...', sourcePlatform: 'facebook', targetPlatforms: ['instagram', 'tiktok', 'youtube'] }`.

### 3. InsufficientCredits flow

`aiCredits = 0` rồi. Click **AI Assist** → Generate lần nữa.

Verify response:
```json
{
  "code": 16000,
  "message": "Không đủ AI credit",
  "data": { "required": 1, "available": 0 }
}
```

Web UI hiển thị toast error + button **Top up credits** → redirect `/settings/billing`.

### 4. AI image gen

Web compose → click **AI Image** button (nếu có UI — nếu chưa, gọi API):

```bash
curl -X POST http://localhost:3000/api/v1/ai/image \
  -H "Cookie: sf_access=<jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "minimalist logo cho sociflow, gradient tím xanh",
    "size": "1024x1024",
    "quality": "standard"
  }'
```

Wait ~15-25s (DALL-E 3 slow). Response:
```json
{
  "code": 0,
  "data": {
    "url": "https://oaidalleapiprodscus.blob.core.windows.net/...",
    "mediaAssetId": "clxxx"
  }
}
```

Verify MediaAsset row đã tạo (image copy từ OpenAI URL sang R2/MinIO cho persist):
```sql
SELECT id, type, "publicUrl", metadata->'aiPrompt' as prompt
FROM "MediaAsset" WHERE metadata->>'source' = 'ai-gen';
```

Credit giảm thêm (image cost cao hơn — config flat 1 hoặc theo cost). Verify policy trong `AiService.generateImage`.

### 5. Provider failover (optional)

Manual break OpenAI key (đổi sai trong `.env` của apps/ai, restart):

```bash
# In apps/ai/.env
OPENAI_API_KEY=sk-INVALID

# Restart only ai
pnpm --filter @sociflow/ai dev
```

Generate caption → expect:
- Provider abstraction try `openai` fail → fallback `anthropic` (nếu config)
- Nếu chỉ 1 provider → trả `code: AiProviderUnavailable`

Restore key sau test.

### 6. Stripe top-up → grant credits

Web: <http://localhost:3020/settings/billing> → click **Buy 100 credits** ($10).

Stripe Checkout redirect → use test card `4242 4242 4242 4242` / any future date / any CVC.

Sau success → redirect về `/settings/billing?status=success`.

Stripe sends webhook `checkout.session.completed` → backend handler:
- Verify signature
- Parse session metadata `{ userId, credits: 100 }`
- `User.update({ aiCredits: { increment: 100 } })`

Verify:
```sql
SELECT "aiCredits" FROM "User" WHERE id = '<userId>';
```
`0 → 100`.

Re-test step 1 (caption gen) — phải OK lại.

Verify `BillingEvent` audit row:
```sql
SELECT * FROM "BillingEvent" ORDER BY "createdAt" DESC LIMIT 1;
```

> ⚠️ Stripe module chưa scaffold trong Phase 6. Phase 7 task — F-701. Skip step này nếu chưa có UI.

## Cleanup

```bash
docker exec -it sociflow-postgres psql -U sociflow -d sociflow_dev -c "
UPDATE \"User\" SET \"aiCredits\" = 100 WHERE email = 'test@sociflow.local';
DELETE FROM \"MediaAsset\" WHERE metadata->>'source' = 'ai-gen';
DELETE FROM \"BillingEvent\";
"
```

## Known issues

### Caption response rỗng hoặc malformed JSON
- OpenAI sometimes trả markdown wrap `'''json ... '''` — verify `JSON.parse` strip wrapper.
- Add `response_format: { type: 'json_object' }` cho gpt-4o models.

### "Rate limit exceeded" từ OpenAI
- Free tier ~3 RPM. Add retry `exponential backoff` trong `OpenAiCaptionProvider`.
- Hoặc upgrade billing.

### `aiCredits` không decrement atomic
- Nếu 2 request concurrent → race condition. Verify dùng `update where aiCredits >= N` (atomic SQL) chứ không `find → check → update`.

### DALL-E image URL expire sau 1 giờ
- Phải copy sang R2 ngay khi nhận → không lưu raw OpenAI URL trong DB.

### Stripe webhook không nhận
- Stripe CLI must running: `stripe listen --forward-to http://localhost:3000/api/v1/webhook/stripe`
- Verify `STRIPE_WEBHOOK_SECRET` lấy từ output `stripe listen` (whsec_xxx).
- Raw body required → check `apps/api/src/main.ts` raw body capture cho `/webhook/stripe` route.

## Next

→ [smoke-test-phase5.md](smoke-test-phase5.md) — Browser extension automation
