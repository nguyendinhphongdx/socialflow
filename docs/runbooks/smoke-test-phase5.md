---
title: Smoke test — Phase 5 (Browser extension automation)
description: Verify extension pair flow, WS connection, TikTok automation dispatch, agent revoke
audience: [developer]
---

# Smoke test — Phase 5 (Extension automation)

Verify: build extension dev → install Chrome → pair code 6-digit → WS online → compose AUTOMATION mode → content script open TikTok upload → status update qua WS → revoke agent.

## Pre-requisites

1. Chrome / Chromium / Edge với developer mode enabled.

2. Build extension dev:
   ```bash
   pnpm --filter @sociflow/extension build:dev
   ```
   Output: `apps/extension/dist/` chứa `manifest.json` + `bg.js` + content scripts.

3. `pnpm dev` running (api / ai / web).

4. User logged in trên web. Đã có 1 SocialAccount với `connectionMode = 'AUTOMATION'` (hoặc tạo via API).

5. (Optional) Tài khoản TikTok thật để login trong extension browser session.

## Steps

### 1. Install extension dev build

Chrome → <chrome://extensions/> → toggle **Developer mode** ON → **Load unpacked** → chọn `apps/extension/dist/`.

Extension xuất hiện trong toolbar với icon Sociflow.

Verify:
- Click icon → popup mở
- Popup hiển thị state `unpaired` với form 6-digit input
- Console (`chrome://extensions` → service worker → Inspect) không có lỗi đỏ

### 2. Generate pair code

Web: <http://localhost:3020/dashboard/devices> → click **+ Pair new device**.

Modal mở:
- 6-digit code hiển thị (vd `123456`)
- Countdown 5 phút
- Status: `pending`

Verify DB:
```bash
docker exec -it sociflow-postgres psql -U sociflow -d sociflow_dev -c "
SELECT id, \"pairCode\", \"pairExpiresAt\", status
FROM \"AutomationAgent\" WHERE status = 'PENDING_PAIR'
ORDER BY \"createdAt\" DESC LIMIT 1;
"
```

`pairCode` = `123456` (plaintext lúc pending, sẽ wipe sau claim).

### 3. Claim pair code

Extension popup → nhập `123456` → click **Connect**.

Extension call `POST /agent/pair/claim` với `{ code, userAgent }`:
- BE atomic: `SELECT FOR UPDATE` row, verify code + not expired → generate `agentToken` random → hash sha256 → save → return plaintext token.
- Extension lưu token vào `chrome.storage.local`.

Popup → state `paired` với:
- Display name (vd "Chrome on macOS")
- Status: Connected
- Disconnect button

### 4. WS connection

Extension service worker → Socket.IO client connect `ws://localhost:3000/agents` với handshake:
```
auth: { token: <agentToken> }
```

Verify:
- API log: `[AgentGateway] agent <id> connected`
- Redis: `GET agent:online:<agentId>` = `1`
- Web devices page auto-refresh → status đổi `Connected` (green dot)

```bash
docker exec -it sociflow-redis redis-cli GET "agent:online:<agentId>"
```

Heartbeat mỗi 30s — verify TTL extend.

### 5. Compose post AUTOMATION mode

Web → <http://localhost:3020/dashboard/compose>:
- Chọn account TikTok (đã set `connectionMode = 'AUTOMATION'`)
- Title: bỏ trống (TT không cần)
- Body: `Smoke phase 5 automation`
- Drop 1 video MP4 (< 50MB)
- Click **Publish ngay**

System tạo `PublishRecord` → consumer detect `connectionMode = 'AUTOMATION'` → KHÔNG gọi provider API → emit `AgentDispatcher.dispatch({ taskId, platform: 'TIKTOK', payload })`.

Verify:
```sql
SELECT id, status, "agentTaskId" FROM "PublishRecord" ORDER BY "createdAt" DESC LIMIT 1;
SELECT id, status, "agentId", platform, "createdAt" FROM "AutomationTask" ORDER BY "createdAt" DESC LIMIT 1;
```

WS emit `task.dispatch` → extension nhận → log:
```
[ext bg] task.dispatch received { taskId, platform: 'TIKTOK' }
```

### 6. Content script automation

Extension service worker:
- Mở tab mới `https://www.tiktok.com/upload?lang=en`
- Inject `content-scripts/tiktok.ts`
- Send `task.start` ACK qua WS

Content script execute 5 stages:
1. `wait-upload-page` — DOM `[data-e2e=upload-area]` visible
2. `select-file` — fetch video URL → blob → DataTransfer → fire `input[type=file]` change
3. `wait-process` — wait `[data-e2e=upload-progress=100%]`
4. `fill-caption` — fire synthetic input event vào caption editor
5. `submit` — click `[data-e2e=publish-button]`

Mỗi stage emit `task.progress` qua WS → server update `AutomationTask.stage` + `PublishRecord.stage`.

> ⚠️ Hiện tại Phase 5 là **stub** — TikTok script chỉ log 5 stage progress events, không thật sự click DOM. Verify log popup console mode + WS message flow, KHÔNG verify post lên TikTok thật.

### 7. Manual confirm

Nếu DOM selector matches → user thấy upload page TT thật, có thể manual click Submit.

Sau Submit:
- TT redirect → extension `webNavigation.onCommitted` detect → emit `task.complete` với `platformPostId` extract từ URL.
- Server update `PublishRecord.status = 'PUBLISHED'`, `workLink`, `platformPostId`.

Verify:
```sql
SELECT status, "workLink", "platformPostId"
FROM "PublishRecord" WHERE id = '<id>';
```

### 8. Failure path (force fail)

Compose → AUTOMATION mode → publish nhưng tab không có TT login session:
- Content script không tìm thấy `[data-e2e=upload-area]` sau 30s
- Emit `task.fail` với reason `LoginRequired`
- Server update `PublishRecord.status = 'FAILED'`, `errorMessage`

Verify:
```sql
SELECT status, "errorMessage" FROM "PublishRecord" WHERE status = 'FAILED' ORDER BY "createdAt" DESC LIMIT 1;
```

### 9. Revoke agent

Web devices page → row agent → kebab → **Revoke**.

System:
- `AutomationAgent.status = 'REVOKED'`
- `agentToken` rotate (invalidate cũ)
- WS gateway disconnect socket

Verify:
- Extension popup → state đổi `unpaired` (token failed handshake)
- Redis `agent:online:<id>` removed

Re-connect cần pair lại từ đầu.

## Cleanup

```bash
docker exec -it sociflow-postgres psql -U sociflow -d sociflow_dev -c "
TRUNCATE \"AutomationTask\", \"AutomationAgent\" CASCADE;
UPDATE \"SocialAccount\" SET \"connectionMode\" = 'API';
"
docker exec -it sociflow-redis redis-cli --scan --pattern 'agent:*' | xargs -r docker exec -i sociflow-redis redis-cli DEL
```

Chrome → uninstall extension dev.

## Known issues

### Service worker bị Chrome suspend
- MV3 SW timeout ~30s idle. Verify `chrome.alarms` keep-alive thay vì `setInterval`.
- Heartbeat WS phải triggered từ alarm event, không từ JS timer.

### WS reconnect loop
- Exponential backoff: 1s → 2s → 4s → 8s → max 30s.
- Verify `apps/extension/src/background/ws-client.ts` có backoff logic.

### Content script không inject
- Check `manifest.json` `host_permissions` include `*://*.tiktok.com/*`.
- Check `content_scripts.matches` đúng URL.
- Manual reload extension sau khi rebuild.

### File upload qua DataTransfer fail
- TikTok require File từ user gesture — workaround: open file picker dialog, user chọn lại từ disk.
- Hoặc CORS proxy via SW: SW fetch video URL → respond as blob → content script receive.

### `task.complete` không nhận
- Verify `webNavigation.onCommitted` listener registered.
- Verify URL pattern match regex extract post ID.

## Next

→ [smoke-test-phase6.md](smoke-test-phase6.md) — Engagement + Analytics
