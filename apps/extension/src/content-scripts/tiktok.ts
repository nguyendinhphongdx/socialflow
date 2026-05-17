/// <reference types="chrome" />

/**
 * TikTok content script — Phase 5 polish.
 *
 * Flow chuẩn 5 stage:
 *  1. navigate     — đảm bảo đang ở /upload
 *  2. attach-media — inject Blob vào input[type=file]
 *  3. compose      — fill caption (data-e2e=caption-input)
 *  4. submit       — click Post button
 *  5. verify       — wait redirect tới /post/<id>, extract video URL
 *
 * Hiện stub — không inject Blob thật (cần fetch CORS handling).
 * Mock postId để FE flow hoạt động end-to-end.
 */

import type { PublishCommand } from '@sociflow/ws-protocol'
import {
  captureForFailure,
  keystrokeDelay,
  loadSelectors,
  pauseBetweenActions,
  query,
  reportComplete,
  reportFailed,
  reportStage,
  sleep,
  waitForSelector,
} from '../shared'

console.warn('[sociflow-agent] tiktok content script loaded:', location.href)

interface RunningTask {
  taskId: string
  cancelled: boolean
}

let running: RunningTask | null = null

async function fillCaption(el: HTMLElement, text: string): Promise<void> {
  el.focus()
  for (const char of text) {
    document.execCommand('insertText', false, char)
    await keystrokeDelay()
  }
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

export async function runPublishTask(command: PublishCommand): Promise<void> {
  const { taskId, content } = command
  const sel = await loadSelectors('TIKTOK')

  // 1. Navigate
  reportStage(taskId, 'navigate')
  if (!location.href.includes('/upload')) {
    location.href = 'https://www.tiktok.com/upload'
    await waitForSelector(sel['upload.file-input'], { timeoutMs: 45_000 })
  }
  await pauseBetweenActions()
  if (running?.cancelled) return

  // 2. Attach media
  reportStage(taskId, 'attach-media')
  const fileInput = await waitForSelector<HTMLInputElement>(sel['upload.file-input'], { timeoutMs: 15_000 })
  // TODO(real-dom): fetch(content.mediaUrls[0].url) → Blob → DataTransfer → fileInput.files
  console.warn('[sociflow-agent] tiktok media attach skipped (stub)', {
    taskId,
    inputPresent: Boolean(fileInput),
    count: content.mediaUrls.length,
  })
  await pauseBetweenActions(1500, 3500)
  if (running?.cancelled) return

  // 3. Compose caption
  reportStage(taskId, 'compose')
  const captionEl = query<HTMLElement>(sel['composer.caption'])
  if (captionEl && content.body) {
    await fillCaption(captionEl, content.body)
  }
  await pauseBetweenActions()
  if (running?.cancelled) return

  // 4. Submit
  reportStage(taskId, 'submit')
  const postBtn = query<HTMLElement>(sel['composer.post-button'])
  if (postBtn) {
    postBtn.click()
  }

  // 5. Verify
  reportStage(taskId, 'verify')
  await sleep(2000)
  // TODO(real-dom): waitForUrl(/\/post\/\d+/) rồi extract id từ URL
  const mockPostId = `tt_mock_${Date.now()}`
  const mockUsername = content.body?.match(/@(\w+)/)?.[1] ?? command.accountUid
  reportComplete(
    taskId,
    mockPostId,
    `https://www.tiktok.com/@${mockUsername}/video/${mockPostId}`,
  )
}

async function executeTask(command: PublishCommand): Promise<void> {
  try {
    await runPublishTask(command)
  }
  catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown error'
    const screenshot = await captureForFailure(command.taskId)
    reportFailed(command.taskId, reason, { screenshotUrl: screenshot.url })
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== 'object') return false

  if (message.type === 'EXEC_PUBLISH' && message.command) {
    const command = message.command as PublishCommand
    if (running && !running.cancelled) {
      sendResponse({ ok: false, reason: 'busy' })
      return false
    }
    running = { taskId: command.taskId, cancelled: false }
    sendResponse({ ok: true })
    void executeTask(command).finally(() => { running = null })
    return false
  }

  if (message.type === 'CANCEL_TASK' && running && running.taskId === message.taskId) {
    running.cancelled = true
    reportFailed(running.taskId, 'cancelled_by_server', { recoverable: false })
    sendResponse({ ok: true })
    return false
  }

  return false
})
