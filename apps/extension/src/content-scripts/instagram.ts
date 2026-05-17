/// <reference types="chrome" />

/**
 * Instagram content script — Phase 5 polish skeleton.
 *
 * Flow chuẩn 5 stage (single photo / carousel / reel):
 *  1. navigate     — instagram.com home → click "New post"
 *  2. compose      — fill caption (sau khi qua các bước Next)
 *  3. attach-media — upload ảnh/video qua hidden input
 *  4. submit       — click "Share"
 *  5. verify       — chờ toast / route change
 *
 * TODO(real-dom): Instagram thay đổi DOM thường xuyên (data-attribute
 * hash random). Selectors cần inspect runtime + push qua WS.
 * Carousel multi-step (Next → Next → Share) cũng cần extra logic.
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

console.warn('[sociflow-agent] instagram content script loaded:', location.href)

interface RunningTask {
  taskId: string
  cancelled: boolean
}

let running: RunningTask | null = null

async function typeIntoTextarea(el: HTMLTextAreaElement, text: string): Promise<void> {
  el.focus()
  for (const char of text) {
    document.execCommand('insertText', false, char)
    await keystrokeDelay()
  }
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

async function clickNextChain(maxClicks = 2): Promise<void> {
  for (let i = 0; i < maxClicks; i++) {
    const next = query<HTMLElement>('div[role="button"]')
    // TODO(real-dom): tìm đúng "Next" theo text content
    if (!next) break
    next.click()
    await pauseBetweenActions(800, 1600)
  }
}

export async function runPublishTask(command: PublishCommand): Promise<void> {
  const { taskId, content } = command
  const sel = await loadSelectors('INSTAGRAM')

  // 1. Navigate
  reportStage(taskId, 'navigate')
  if (!/instagram\.com\/?($|\?)/.test(location.href)) {
    location.href = 'https://www.instagram.com/'
    await waitForSelector(sel['composer.entry'], { timeoutMs: 45_000 })
  }
  await pauseBetweenActions()
  if (running?.cancelled) return

  const entryIcon = query<HTMLElement>(sel['composer.entry'])
  // SVG icon → click parent button
  const entryBtn = entryIcon?.closest<HTMLElement>('div[role="button"], button') ?? entryIcon
  if (!entryBtn) throw new Error('instagram new-post entry not found')
  entryBtn.click()
  await pauseBetweenActions(800, 1800)

  // 3. Attach media trước (Instagram bắt buộc upload trước khi tới caption)
  reportStage(taskId, 'attach-media')
  const fileInput = await waitForSelector<HTMLInputElement>(sel['composer.file-input'], { timeoutMs: 15_000 })
  // TODO(real-dom): fetch media URLs → File[] → DataTransfer → fileInput.files
  console.warn('[sociflow-agent] ig media attach skipped (stub)', {
    taskId,
    inputPresent: Boolean(fileInput),
    count: content.mediaUrls.length,
  })
  await pauseBetweenActions(1500, 3000)
  if (running?.cancelled) return

  // Đi qua các bước "Next" (Crop → Edit → Caption)
  await clickNextChain(2)

  // 2. Compose caption
  reportStage(taskId, 'compose')
  const captionEl = await waitForSelector<HTMLTextAreaElement>(sel['composer.caption'], { timeoutMs: 10_000 })
  const body = content.body ?? content.title ?? ''
  if (body) await typeIntoTextarea(captionEl, body)
  if (running?.cancelled) return

  // 4. Submit
  reportStage(taskId, 'submit')
  await pauseBetweenActions()
  const shareBtn = await waitForSelector<HTMLElement>(sel['composer.share-button'], { timeoutMs: 10_000 })
  shareBtn.click()

  // 5. Verify
  reportStage(taskId, 'verify')
  await sleep(2500)
  // TODO(real-dom): IG không expose post URL trong toast — cần intercept
  // GraphQL response hoặc poll profile feed cho post mới nhất.
  const mockPostId = `ig_mock_${Date.now()}`
  reportComplete(
    taskId,
    mockPostId,
    `https://www.instagram.com/p/${mockPostId}/`,
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
