# @sociflow/extension

Chrome Manifest V3 extension cho Sociflow automation agent.

## Phase 5 (current)

- Popup pair UI (6-digit code → `POST /api/v1/agents/pair/claim`)
- Background service worker:
  - Đọc agentToken từ `chrome.storage.local`
  - Connect WS (socket.io) tới `{wsUrl}/agents` với token auth
  - Exponential backoff reconnect (5s → 300s)
  - Heartbeat 30s qua `chrome.alarms`
  - Dispatch publish commands → mở tab platform → forward tới content script
  - Forward status/complete/failed events từ content script lên server
- Content scripts:
  - TikTok: stub publish flow với progress events (real DOM polish Phase 5+)
  - Facebook / Instagram / YouTube: placeholder, will implement Phase 6

## Build

```bash
pnpm --filter @sociflow/extension build
```

Output ở `dist/`. Load vào Chrome:

1. Mở `chrome://extensions`
2. Bật Developer mode
3. Load unpacked → chọn `apps/extension/dist`

## Icons

Cần file `public/icons/icon-{16,48,128}.png`. Phase 0 chưa có — Chrome sẽ dùng default icon.

## Phase 6+ scope

- Real TikTok DOM automation (Blob → DataTransfer file injection, redirect detect)
- Facebook / Instagram / YouTube content scripts
- Comment/like commands
- Selector hot-update từ server

Xem [docs/05-automation-extension.md](../../docs/05-automation-extension.md).
