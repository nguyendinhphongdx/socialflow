---
title: Browser automation & extension
description: Kiến trúc Chrome extension, WebSocket protocol, content-script automation
audience: [developer, ai-agent]
---

# Browser automation & extension

Cho phép đăng bài / engage trên platform mà user không có OAuth API access, hoặc API bị giới hạn.

## Tại sao Extension thay vì server-side headless?

| | Server Playwright/Puppeteer | Chrome Extension (chọn) |
|---|---|---|
| Session login | Phải copy cookie từ user → khó duy trì | Dùng trực tiếp tab đã login |
| Fingerprint | Headless dễ bị detect | Browser thật của user |
| Captcha | Server không qua được | User tự click qua khi cần |
| 2FA | Phải share TOTP secret | User tự xác thực bình thường |
| TOS risk | Cao (server-side automation) | Trung bình |
| Infra cost | Tốn (1 instance/tab) | Zero — chạy trên máy user |
| Install friction | 0 (server-side) | 1-click Chrome Web Store |

## Kiến trúc 3-layer

```
┌─────────────────────────────────────────────────────────────────┐
│  apps/api/automation                                            │
│  ┌─────────────────┐  ┌──────────────────────┐                  │
│  │ AutomationGate- │  │ AutomationDispatcher │                  │
│  │ way (WS)        │◄─┤ Service              │                  │
│  │ Socket.io /api/ │  │                      │                  │
│  │   automation/ws │  │ - find online agent  │                  │
│  └────────┬────────┘  │ - send command        │                  │
│           │           │ - track task status   │                  │
│           │           └──────────────────────┘                  │
└───────────┼─────────────────────────────────────────────────────┘
            │ WebSocket (long-lived, JWT auth)
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│  apps/extension (Chrome MV3)                                    │
│  ┌─────────────────────────────────┐                            │
│  │ background/service-worker.ts    │                            │
│  │ - WS client (reconnect)         │                            │
│  │ - dispatch to content scripts   │                            │
│  │ - manage tabs                   │                            │
│  └────────┬────────────────────────┘                            │
│           │ chrome.tabs.sendMessage                              │
│           ▼                                                     │
│  ┌─────────────────────────────────┐                            │
│  │ content-scripts/                │                            │
│  │ - tiktok.ts (DOM upload)        │                            │
│  │ - facebook.ts                   │                            │
│  │ - instagram.ts                  │                            │
│  │ - youtube.ts                    │                            │
│  └─────────────────────────────────┘                            │
│           │ run in user's logged-in platform tab                │
└───────────┼─────────────────────────────────────────────────────┘
            │
            ▼
       [platform.com] — user đã login sẵn
```

## Pairing flow

User cần "link" extension với tài khoản Sociflow:

```
1. User login web → /settings/extension
2. Click "Pair extension"
   → POST /api/automation/pair-code
   → Backend tạo:
     - AutomationAgent (placeholder)
     - 6-digit code, TTL 5 phút
   → Web hiển thị code
3. User mở extension popup → "Connect"
   → User dán code → POST /api/automation/pair { code }
4. Backend verify code:
   - Tạo agentToken (long-lived JWT, revocable)
   - Update AutomationAgent: status=paired, agentTokenHash
5. Extension store agentToken vào chrome.storage.local
6. Extension WS connect: ws://api/automation/ws
   - Header: Authorization: Bearer <agentToken>
7. Backend verify → set agent.online = true
8. Extension popup show "● Connected"
```

## WebSocket protocol

Define ở `packages/ws-protocol`:

```ts
// packages/ws-protocol/src/types.ts

// Server → Client
export type ServerMessage =
  | { type: 'HELLO_ACK', agentId: string, capabilities: string[] }
  | { type: 'PING' }
  | { type: 'TASK', task: AutomationTaskPayload }
  | { type: 'CANCEL_TASK', taskId: string }
  | { type: 'SELECTOR_UPDATE', platform: AccountPlatform, selectors: SelectorMap }
  | { type: 'EXTENSION_UPDATE_AVAILABLE', version: string }

// Client → Server
export type ClientMessage =
  | { type: 'HELLO', version: string, os: string, browser: string, capabilities: string[] }
  | { type: 'PONG' }
  | { type: 'TASK_ACK', taskId: string }
  | { type: 'TASK_PROGRESS', taskId: string, stage: TaskStage, percent: number }
  | { type: 'TASK_SUCCESS', taskId: string, result: TaskResult }
  | { type: 'TASK_FAIL', taskId: string, error: string, screenshotR2Key?: string }

export type TaskStage =
  | 'PREPARING'
  | 'OPENING_TAB'
  | 'DOWNLOADING_MEDIA'
  | 'UPLOADING'
  | 'FILLING_FORM'
  | 'SUBMITTING'
  | 'AWAITING_REVIEW'

export interface AutomationTaskPayload {
  taskId: string
  command: 'PUBLISH_POST' | 'POST_COMMENT' | 'FETCH_COMMENTS' | 'LIKE_POST'
  platform: AccountPlatform
  platformUid: string         // tài khoản nào (extension check tab đang login đúng account)
  payload: PublishTaskPayload | CommentTaskPayload | ...
}

export interface PublishTaskPayload {
  videoUrl?: string           // pre-signed R2 URL
  imageUrls?: string[]
  title?: string
  body?: string
  hashtags?: string[]
  options?: Record<string, unknown>
}

export interface TaskResult {
  platformPostId: string
  workLink: string
  metadata?: Record<string, unknown>
}
```

### Heartbeat

- Server ping mỗi 30s, agent phải pong trong 10s → nếu không, mark offline
- Agent reconnect với exponential backoff (1s, 2s, 5s, 10s, 30s, max 60s)

### Idempotency

- `taskId` từ backend = UUID
- Agent track `taskId` đã xử lý trong `chrome.storage.local`
- Nếu nhận lại task cùng `taskId` → check status, nếu đã SUCCESS thì re-send TASK_SUCCESS thay vì làm lại

## Extension architecture

```
apps/extension/
├── manifest.json              # MV3 manifest
├── src/
│   ├── background/
│   │   ├── service-worker.ts  # Entry — WS client, command dispatcher
│   │   ├── ws-client.ts       # Socket.io client + reconnect logic
│   │   ├── task-router.ts     # Dispatch task → content script đúng platform
│   │   ├── storage.ts         # Wrapper chrome.storage.local
│   │   └── auth.ts            # Pairing flow, token management
│   │
│   ├── content-scripts/
│   │   ├── _base/
│   │   │   ├── selectors-registry.ts   # Hot-updatable selectors
│   │   │   ├── human-delay.ts          # Random delay helpers
│   │   │   ├── file-injector.ts        # input[type=file] hack (DataTransfer)
│   │   │   └── progress-reporter.ts    # Send progress to background
│   │   ├── tiktok.ts
│   │   ├── facebook.ts
│   │   ├── instagram.ts
│   │   └── youtube.ts
│   │
│   ├── offscreen/
│   │   └── file-handler.html  # MV3 offscreen doc — download large files
│   │
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.ts
│   │   └── popup.css
│   │
│   └── options/
│       └── options.html       # Settings page
│
├── public/
│   └── icons/
│
└── package.json
```

### manifest.json (MV3)

```json
{
  "manifest_version": 3,
  "name": "Sociflow Agent",
  "version": "0.1.0",
  "description": "Sociflow browser agent — đăng bài & engage tự động",
  "permissions": [
    "storage",
    "tabs",
    "scripting",
    "offscreen",
    "downloads"
  ],
  "host_permissions": [
    "https://*.tiktok.com/*",
    "https://*.facebook.com/*",
    "https://*.instagram.com/*",
    "https://*.youtube.com/*",
    "https://studio.youtube.com/*",
    "https://api.sociflow.io/*",
    "wss://api.sociflow.io/*"
  ],
  "background": {
    "service_worker": "background/service-worker.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["https://*.tiktok.com/upload*", "https://*.tiktok.com/creator-center/*"],
      "js": ["content-scripts/tiktok.js"]
    },
    {
      "matches": ["https://*.facebook.com/*"],
      "js": ["content-scripts/facebook.js"]
    },
    {
      "matches": ["https://*.instagram.com/*"],
      "js": ["content-scripts/instagram.js"]
    },
    {
      "matches": ["https://studio.youtube.com/*"],
      "js": ["content-scripts/youtube.js"]
    }
  ],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/16.png",
      "48": "icons/48.png",
      "128": "icons/128.png"
    }
  },
  "options_page": "options/options.html"
}
```

## Content script pattern

```ts
// apps/extension/src/content-scripts/_base/types.ts
export interface PlatformAutomation {
  uploadVideo(payload: PublishTaskPayload): Promise<TaskResult>
  postText(payload: PublishTaskPayload): Promise<TaskResult>
  postComment(payload: CommentTaskPayload): Promise<TaskResult>
  fetchComments(postId: string): Promise<Comment[]>
}

// apps/extension/src/content-scripts/tiktok.ts
import { humanDelay, injectFile, reportProgress } from './_base'
import { getSelectors } from './_base/selectors-registry'

export const tiktokAutomation: PlatformAutomation = {
  async uploadVideo(payload) {
    const sel = await getSelectors('TIKTOK')
    reportProgress('OPENING_TAB', 5)

    // 1. Navigate (nếu chưa ở /upload)
    if (!location.pathname.includes('/upload')) {
      location.href = 'https://www.tiktok.com/upload'
      await waitForSelector(sel.uploadInput, 30_000)
    }
    reportProgress('UPLOADING', 10)

    // 2. Inject file vào input[type=file]
    const fileInput = document.querySelector<HTMLInputElement>(sel.uploadInput)
    if (!fileInput) throw new Error('upload input not found')

    const blob = await downloadToBlob(payload.videoUrl!)
    injectFile(fileInput, blob, 'video.mp4')

    // 3. Đợi TT process video (poll progress bar)
    await waitForUploadComplete(sel.uploadProgressDone, 5 * 60_000)
    reportProgress('FILLING_FORM', 60)

    // 4. Điền caption
    await humanDelay()
    const captionEditor = document.querySelector<HTMLElement>(sel.captionEditor)
    await typeWithDelay(captionEditor, payload.body ?? '')

    // 5. Hashtag tự động (TT parse #)
    // 6. Cover thumbnail (giữ default)

    // 7. Privacy
    if (payload.options?.privacy) {
      await setPrivacy(sel.privacyDropdown, payload.options.privacy)
    }
    reportProgress('SUBMITTING', 90)

    // 8. Click Post
    await humanDelay()
    document.querySelector<HTMLButtonElement>(sel.postButton)?.click()

    // 9. Đợi redirect → URL có postId
    const url = await waitForNavigation(/\/video\/\d+/, 60_000)
    const postId = url.match(/\/video\/(\d+)/)?.[1]
    if (!postId) throw new Error('failed to extract postId')

    return {
      platformPostId: postId,
      workLink: `https://www.tiktok.com/@${getCurrentUsername()}/video/${postId}`,
    }
  },
  // ...
}

// Listen for background messages
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'EXECUTE_TASK' && msg.platform === 'TIKTOK') {
    tiktokAutomation[msg.method](msg.payload)
      .then(result => sendResponse({ ok: true, result }))
      .catch(err => sendResponse({ ok: false, error: err.message }))
    return true  // async response
  }
})
```

## Selector hot-update

Để fix DOM selector mà không cần update extension:

```
1. Selectors lưu trong Postgres table:
   model AutomationSelector {
     platform   AccountPlatform
     key        String       // 'uploadInput' | 'captionEditor' | ...
     selector   String       // CSS / XPath
     version    Int
     updatedAt  DateTime
     @@unique([platform, key])
   }

2. Extension HELLO → server reply HELLO_ACK với selectorVersion
3. Nếu local version < server → server push SELECTOR_UPDATE message
4. Extension lưu vào chrome.storage.local
5. Content script gọi getSelectors() → đọc từ storage
```

→ Khi TikTok đổi class CSS, admin chỉ update DB row, mọi extension nhận trong 30s.

## Anti-detection tactics

| Technique | Mô tả |
|---|---|
| **Human delay** | `await humanDelay(min=500, max=2000)` — random giữa các action |
| **Typing simulation** | `typeWithDelay()` — gõ từng ký tự với delay 50-150ms, không paste cả chuỗi |
| **Mouse movement** | (optional) `ghost-cursor` library mô phỏng curved path |
| **No DevTools protocol** | KHÔNG dùng `chrome.debugger`, KHÔNG dùng Puppeteer (bị detect) |
| **No synthetic events** | Tránh `dispatchEvent` với `new Event()` (`isTrusted: false`). Dùng `input` qua focus + simulated typing |
| **Real session** | Dựa vào tab login sẵn, không tự login → không trigger anti-bot login flow |
| **Rate limit per account** | Max 10 post/24h/account default, configurable |
| **Variability** | Random viewport scroll trước khi action, mở tab khác trong session |

## Failure & screenshot

Khi automation fail:

```ts
catch (err) {
  // 1. Capture screenshot
  const dataUrl = await captureScreenshot()
  const r2Key = `automation-errors/${taskId}.png`
  await uploadToR2(r2Key, dataUrl)

  // 2. Capture DOM snippet (selector parent)
  const domHtml = sel.captionEditor.outerHTML
  await uploadToR2(`automation-errors/${taskId}.html`, domHtml)

  // 3. Report
  ws.send({
    type: 'TASK_FAIL',
    taskId,
    error: err.message,
    screenshotR2Key: r2Key,
  })
}
```

Backend lưu vào `AutomationTask.errorScreenshotUrl` → admin debug được.

## Rate limit + queue ở agent

Agent có thể nhận nhiều task cùng lúc nhưng phải chạy tuần tự (1 tab/platform):

```ts
// Background: task queue
const platformQueue: Record<AccountPlatform, Queue> = {
  TIKTOK: new Queue(),
  FACEBOOK: new Queue(),
  // ...
}

function handleTask(task: TaskPayload) {
  platformQueue[task.platform].add(async () => {
    await executeOnContentScript(task)
  })
}
```

## Security

1. **agentToken** chỉ store ở `chrome.storage.local` (không sync). Không log ra console.
2. **Revoke**: user click "Revoke" → backend mark `AutomationAgent.revokedAt`. Extension nhận `401 unauthorized` lần WS reconnect tới → tự clear token + show "Re-pair needed".
3. **WS auth**: verify JWT mỗi message? Không, chỉ verify lúc CONNECT. WS connection lifetime = token validity.
4. **CSP**: extension không inject script từ URL ngoài. Tất cả code bundled.
5. **Permissions**: tối thiểu — chỉ host_permissions cho platform support.

## Update strategy

- **Manifest version bump** → Chrome Web Store auto-update trong vài giờ
- **Selector hot-update** → instant, không cần extension update
- **Breaking protocol change** → tăng `protocolVersion` field, backend backward-compat ít nhất 1 version cũ

## Browser support

| Browser | Support? |
|---|---|
| Chrome / Chromium | ✅ Primary |
| Edge | ✅ (Chromium-based) |
| Brave | ✅ (Chromium-based) |
| Firefox | 🟡 Phase 2 — port qua WebExtension API |
| Safari | ❌ — quá khác, ROI thấp |

## TOS & legal disclaimer

Browser automation **vi phạm TOS** hầu hết platform. UI cần:

1. Warning rõ khi enable AUTOMATION mode
2. Checkbox EULA: "Tôi hiểu rủi ro account bị khoá"
3. Default `publishMode = API`, AUTOMATION là opt-in
4. T&C của Sociflow disclaim trách nhiệm

## Tài liệu liên quan

- [04-publish-flow.md](04-publish-flow.md) — publish bundle dispatcher
- [03-data-model.md](03-data-model.md) — `AutomationAgent`, `AutomationTask`
- [decisions/0003-chrome-extension-only.md](decisions/0003-chrome-extension-only.md) — quyết định chọn extension
