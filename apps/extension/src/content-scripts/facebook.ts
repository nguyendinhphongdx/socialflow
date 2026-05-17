/// <reference types="chrome" />

/**
 * Facebook content script — Phase 5 polish skeleton.
 *
 * Flow chuẩn 5 stage:
 *  1. navigate     — đảm bảo đang ở facebook.com home (composer entry)
 *  2. compose      — fill textarea trong composer dialog
 *  3. attach-media — upload ảnh/video qua file input
 *  4. submit       — click "Post"
 *  5. verify       — phát hiện success toast / chuyển trang feed
 *
 * TODO(real-dom): selectors trong selector-loader hiện là placeholder
 * (data-testid / aria-label). Cần inspect facebook.com composer thật,
 * cập nhật DB → push qua `s2a:selectors-update`.
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

console.warn('[sociflow-agent] facebook content script loaded:', location.href)

interface RunningTask {
  taskId: string
  cancelled: boolean
}

let running: RunningTask | null = null

async function fillContentEditable(el: HTMLElement, text: string): Promise<void> {
  el.focus()
  for (const char of text) {
    document.execCommand('insertText', false, char)
    await keystrokeDelay()
  }
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

export async function runPublishTask(command: PublishCommand): Promise<void> {
  const { taskId, content } = command
  const sel = await loadSelectors('FACEBOOK')

  // 1. Navigate — đảm bảo đang ở home để mở composer.
  reportStage(taskId, 'navigate')
  if (!/facebook\.com\/?(\?|$)/.test(location.href)) {
    location.href = 'https://www.facebook.com/'
    // Cho trang load + composer entry render
    await waitForSelector(sel['composer.entry'] ?? sel['composer.entry-alt'], { timeoutMs: 45_000 })
  }
  await pauseBetweenActions()
  if (running?.cancelled) return

  const entry = query<HTMLElement>(sel['composer.entry']) ?? query<HTMLElement>(sel['composer.entry-alt'])
  if (!entry) throw new Error('facebook composer entry not found')
  entry.click()
  await pauseBetweenActions(800, 2000)

  // 2. Compose — fill textarea
  reportStage(taskId, 'compose')
  const textarea = await waitForSelector<HTMLElement>(sel['composer.textarea'], { timeoutMs: 15_000 })
  await pauseBetweenActions()
  const body = content.body ?? content.title ?? ''
  if (body) await fillContentEditable(textarea, body)
  if (running?.cancelled) return

  // 3. Attach media (nếu có)
  reportStage(taskId, 'attach-media')
  if (content.mediaUrls.length > 0) {
    const mediaBtn = query<HTMLElement>(sel['composer.media-button'])
    if (mediaBtn) {
      mediaBtn.click()
      await pauseBetweenActions(600, 1400)
    }
    const fileInput = await waitForSelector<HTMLInputElement>(sel['composer.file-input'], { timeoutMs: 10_000 })
    // TODO(real-dom): fetch media URL → Blob → DataTransfer → fileInput.files
    // Hiện stub chỉ log; injection thực tế cần test cross-origin fetch headers.
    console.warn('[sociflow-agent] fb media attach skipped (stub)', {
      taskId,
      inputPresent: Boolean(fileInput),
      count: content.mediaUrls.length,
    })
    await pauseBetweenActions(1000, 2500)
  }
  if (running?.cancelled) return

  // 4. Submit
  reportStage(taskId, 'submit')
  const postBtn = await waitForSelector<HTMLElement>(sel['composer.post-button'], { timeoutMs: 10_000 })
  await pauseBetweenActions()
  postBtn.click()

  // 5. Verify — chờ toast success. Mock postId vì chưa có real extractor.
  reportStage(taskId, 'verify')
  await sleep(2000)
  // TODO(real-dom): extract real Facebook post permalink từ toast hoặc network response
  const mockPostId = `fb_mock_${Date.now()}`
  reportComplete(
    taskId,
    mockPostId,
    `https://www.facebook.com/${command.accountUid}/posts/${mockPostId}`,
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
