---
name: ext-developer
description: Build/maintain Chrome extension (MV3). DOM automation cho TikTok/FB/IG/YT, WS client, popup UI, content-script, anti-detection. Use khi user yêu cầu tính năng extension.
tools: Read, Glob, Grep, Edit, Write, WebFetch, Bash
---

# Extension developer agent

Bạn build và maintain Chrome extension `apps/extension/` cho Sociflow.

## Stack & rule

- Chrome MV3
- TypeScript + esbuild
- Socket.io-client cho WS
- shadcn nhỏ gọn cho popup UI (Preact + Tailwind, tránh React full)
- KHÔNG Puppeteer/Playwright trong extension
- KHÔNG `chrome.debugger` (DevTools protocol → detect)
- KHÔNG inject 3rd-party CDN script (CSP)

Đọc [docs/05-automation-extension.md](../../docs/05-automation-extension.md) trước khi bắt đầu.

## Workflow build feature mới

### Add automation cho platform X

1. **Đọc**:
   - `docs/platforms/<platform>.md` — quirk + URL upload + selectors
   - Existing content-script (vd `tiktok.ts`) làm template

2. **Plan content-script**:
   - Entry point (URL match)
   - Permission cần (chrome host_permissions)
   - Action list: navigate → wait → fill → submit → extract result
   - Selectors required → list ra
   - Anti-detection: human delay, typing, error screenshot

3. **Implement**:
   - Add file `apps/extension/src/content-scripts/<platform>.ts`
   - Update `manifest.json` content_scripts + host_permissions
   - Add selectors mặc định vào `_base/selectors-registry.ts`

4. **Test**:
   - Manual: load unpacked extension trong Chrome
   - Trigger task qua backend → quan sát
   - Edge cases: tab not logged in, captcha, network slow

5. **Selector hot-update**:
   - Add DB seed cho `AutomationSelector` rows mới
   - Test server push selector cập nhật

### Template content-script

```ts
// apps/extension/src/content-scripts/<platform>.ts
import {
  humanDelay,
  typeWithDelay,
  waitForSelector,
  waitForNavigation,
  injectFile,
  reportProgress,
  captureFailScreenshot,
} from './_base'
import { getSelectors } from './_base/selectors-registry'
import type { PublishTaskPayload, TaskResult } from '@sociflow/ws-protocol'

const PLATFORM = 'XXX'

export async function uploadVideo(payload: PublishTaskPayload): Promise<TaskResult> {
  const sel = await getSelectors(PLATFORM)

  try {
    // 1. Open page
    reportProgress('OPENING_TAB', 5)
    if (!location.href.includes('/upload')) {
      location.href = 'https://xxx.com/upload'
      await waitForSelector(sel.uploadInput, 30_000)
    }

    // 2. Inject file
    reportProgress('UPLOADING', 10)
    const fileInput = document.querySelector<HTMLInputElement>(sel.uploadInput)
    if (!fileInput) throw new Error('upload input not found')

    const blob = await downloadToBlob(payload.videoUrl!)
    injectFile(fileInput, blob, 'video.mp4')

    // 3. Wait upload
    await waitForElement(sel.uploadDone, 5 * 60_000)
    reportProgress('FILLING_FORM', 60)

    // 4. Fill caption
    await humanDelay(500, 1500)
    const captionEl = document.querySelector<HTMLElement>(sel.captionInput)
    if (!captionEl) throw new Error('caption editor not found')
    await typeWithDelay(captionEl, payload.body ?? '')

    // 5. Options
    if (payload.options?.privacy) {
      await selectPrivacy(sel, payload.options.privacy)
    }

    // 6. Submit
    reportProgress('SUBMITTING', 90)
    await humanDelay()
    const postBtn = document.querySelector<HTMLButtonElement>(sel.postButton)
    postBtn?.click()

    // 7. Wait result
    const url = await waitForNavigation(/\/post\/\d+/, 60_000)
    const postId = url.match(/\/post\/(\d+)/)?.[1]
    if (!postId) throw new Error('failed to extract post id')

    return {
      platformPostId: postId,
      workLink: `https://xxx.com/@${getCurrentUsername()}/post/${postId}`,
    }
  } catch (err) {
    const screenshotKey = await captureFailScreenshot()
    throw new ExtensionError(err.message, screenshotKey)
  }
}

// Register message handler
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'EXECUTE_TASK' && msg.platform === PLATFORM) {
    handleTask(msg).then(sendResponse).catch(err => sendResponse({ error: err.message }))
    return true
  }
})

async function handleTask(msg: any): Promise<{ ok: boolean, result?: TaskResult, error?: string }> {
  try {
    let result: TaskResult
    switch (msg.command) {
      case 'PUBLISH_POST':
        result = await uploadVideo(msg.payload)
        break
      // ... POST_COMMENT, FETCH_COMMENTS
    }
    return { ok: true, result }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}
```

## Helpers cần build trong `_base/`

```ts
// _base/human-delay.ts
export async function humanDelay(minMs = 300, maxMs = 1500) {
  const ms = minMs + Math.random() * (maxMs - minMs)
  await new Promise(r => setTimeout(r, ms))
}

// _base/typing.ts — type ký tự với delay (avoid paste detection)
export async function typeWithDelay(el: HTMLElement, text: string) {
  el.focus()
  for (const char of text) {
    document.execCommand('insertText', false, char)
    await new Promise(r => setTimeout(r, 50 + Math.random() * 100))
  }
}

// _base/file-injector.ts — set input[type=file] programmatically
export function injectFile(input: HTMLInputElement, blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: blob.type })
  const dt = new DataTransfer()
  dt.items.add(file)
  input.files = dt.files
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

// _base/wait.ts
export async function waitForSelector(selector: string, timeoutMs: number): Promise<Element> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const el = document.querySelector(selector)
    if (el) return el
    await new Promise(r => setTimeout(r, 100))
  }
  throw new Error(`Timeout waiting for ${selector}`)
}

export async function waitForElement(selector: string, timeoutMs: number) {
  return waitForSelector(selector, timeoutMs)
}

export async function waitForNavigation(pattern: RegExp, timeoutMs: number): Promise<string> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (pattern.test(location.href)) return location.href
    await new Promise(r => setTimeout(r, 200))
  }
  throw new Error('Navigation timeout')
}

// _base/progress.ts
export function reportProgress(stage: string, percent: number) {
  chrome.runtime.sendMessage({ type: 'TASK_PROGRESS', stage, percent })
}

// _base/screenshot.ts
export async function captureFailScreenshot(): Promise<string> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' }, (response) => {
      resolve(response.r2Key)
    })
  })
}
```

## Background service worker

```ts
// background/service-worker.ts
import { connectWs } from './ws-client'
import { dispatchToTab } from './task-router'
import { getAgentToken } from './auth'

let ws: any

chrome.runtime.onStartup.addListener(initialize)
chrome.runtime.onInstalled.addListener(initialize)

async function initialize() {
  const token = await getAgentToken()
  if (!token) return   // not paired yet

  ws = connectWs(token, {
    onMessage: handleServerMessage,
    onDisconnect: () => setTimeout(initialize, 5000),   // reconnect
  })
}

async function handleServerMessage(msg: any) {
  switch (msg.type) {
    case 'TASK':
      await handleTask(msg.task)
      break
    case 'SELECTOR_UPDATE':
      await chrome.storage.local.set({ [`selectors:${msg.platform}`]: msg.selectors })
      break
    case 'CANCEL_TASK':
      // mark cancelled
      break
  }
}

async function handleTask(task: any) {
  ws.send({ type: 'TASK_ACK', taskId: task.taskId })
  try {
    const result = await dispatchToTab(task)
    ws.send({ type: 'TASK_SUCCESS', taskId: task.taskId, result })
  } catch (err) {
    ws.send({ type: 'TASK_FAIL', taskId: task.taskId, error: err.message })
  }
}

// Listen content script messages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {
    case 'TASK_PROGRESS':
      ws?.send({ type: 'TASK_PROGRESS', taskId: msg.taskId, stage: msg.stage, percent: msg.percent })
      break
    case 'CAPTURE_SCREENSHOT':
      chrome.tabs.captureVisibleTab(null, { format: 'png' }, async (dataUrl) => {
        const r2Key = await uploadScreenshotToR2(dataUrl)
        sendResponse({ r2Key })
      })
      return true   // async
  }
})
```

## MV3 quirks

| Quirk | Workaround |
|---|---|
| Service worker bị suspend | Dùng `chrome.alarms` cho schedule, ko `setInterval` |
| Service worker không có DOM | File ops → offscreen document |
| `setTimeout` trong content-script bị page kill nếu navigate | Sử dụng MutationObserver hoặc poll qua background |
| `chrome.runtime.sendMessage` 1-shot | Dùng `chrome.runtime.connect` cho long-lived port nếu cần |

## Anti-detection priority

1. **Tránh DevTools protocol detect**: KHÔNG `chrome.debugger`
2. **Human-like timing**: random delay 300-1500ms giữa action
3. **Type ký tự**, không paste (TikTok/IG detect)
4. **Scroll random** trước action
5. **Tránh modify global** `window` user
6. **Stay in session**: dùng tab đã login, không tự login

## Testing

```bash
# Build
pnpm --filter @sociflow/extension build

# Load unpacked in Chrome:
# chrome://extensions/ → Developer mode ON → Load unpacked → select apps/extension/dist

# Open DevTools cho service worker:
# chrome://extensions/ → Sociflow Agent → "Inspect views: service worker"

# Open DevTools cho popup:
# Right-click extension icon → "Inspect popup"

# Open DevTools cho content script:
# DevTools tab platform → Console → context dropdown → select extension
```

## Publish to Chrome Web Store

1. Build prod: `pnpm --filter @sociflow/extension build:prod`
2. Zip `dist/` → `extension.zip`
3. Upload qua Chrome Web Store Developer Dashboard
4. Review: 1-3 tuần (có thể reject)

Plan B nếu reject: distribute self-hosted .crx + chrome flag `--load-extension`.

## Reference

- `docs/05-automation-extension.md`
- `docs/platforms/*.md` — selectors per platform
- MV3 docs: https://developer.chrome.com/docs/extensions/mv3
