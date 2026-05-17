/// <reference types="chrome" />

/**
 * YouTube Studio content script — Phase 5 polish skeleton.
 *
 * Flow chuẩn 5 stage:
 *  1. navigate     — studio.youtube.com → click "CREATE" → "Upload videos"
 *  2. attach-media — chọn file qua hidden input
 *  3. compose      — fill title + description trong details dialog
 *  4. submit       — click "DONE"/"PUBLISH" (qua các tab Details → Elements → Checks → Visibility)
 *  5. verify       — extract video URL từ confirmation screen
 *
 * TODO(real-dom): YT Studio dùng Polymer custom elements (ytcp-*).
 * Cần inspect attribute thực tế, đặc biệt là contenteditable cho title.
 * Visibility "Public/Unlisted/Private" cần navigate qua 4 tab.
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

console.warn('[sociflow-agent] youtube content script loaded:', location.href)

interface RunningTask {
  taskId: string
  cancelled: boolean
}

let running: RunningTask | null = null

async function fillEditable(el: HTMLElement, text: string): Promise<void> {
  el.focus()
  for (const char of text) {
    document.execCommand('insertText', false, char)
    await keystrokeDelay()
  }
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

async function clickNextChain(times: number): Promise<void> {
  for (let i = 0; i < times; i++) {
    // TODO(real-dom): selector cho ytcp-button "Next"
    const next = query<HTMLElement>('ytcp-button#next-button')
    if (!next) break
    next.click()
    await pauseBetweenActions(800, 1800)
  }
}

export async function runPublishTask(command: PublishCommand): Promise<void> {
  const { taskId, content } = command
  const sel = await loadSelectors('YOUTUBE')

  // 1. Navigate
  reportStage(taskId, 'navigate')
  if (!/studio\.youtube\.com/.test(location.href)) {
    location.href = 'https://studio.youtube.com/'
    await waitForSelector(sel['upload.create-button'], { timeoutMs: 45_000 })
  }
  await pauseBetweenActions()
  if (running?.cancelled) return

  // Click CREATE → menu "Upload videos"
  const createBtn = query<HTMLElement>(sel['upload.create-button'])
  if (!createBtn) throw new Error('youtube create button not found')
  createBtn.click()
  await pauseBetweenActions(500, 1200)

  const uploadItem = query<HTMLElement>(sel['upload.menu-upload'])
  if (!uploadItem) throw new Error('youtube upload menu item not found')
  uploadItem.click()
  await pauseBetweenActions(800, 1800)

  // 2. Attach media (YT bắt buộc upload trước khi mở details dialog)
  reportStage(taskId, 'attach-media')
  if (content.mediaUrls.length === 0) {
    throw new Error('youtube requires at least 1 video to upload')
  }
  const fileInput = await waitForSelector<HTMLInputElement>(sel['upload.file-input'], { timeoutMs: 15_000 })
  // TODO(real-dom): fetch video URL → Blob → DataTransfer → fileInput.files
  console.warn('[sociflow-agent] yt media attach skipped (stub)', {
    taskId,
    inputPresent: Boolean(fileInput),
    count: content.mediaUrls.length,
  })
  // YT mở details dialog sau khi accept file
  await pauseBetweenActions(2000, 4000)
  if (running?.cancelled) return

  // 3. Compose title + description
  reportStage(taskId, 'compose')
  const titleEl = await waitForSelector<HTMLElement>(sel['upload.title'], { timeoutMs: 20_000 })
  if (content.title) {
    // Xoá default filename rồi fill
    titleEl.focus()
    document.execCommand('selectAll', false)
    await keystrokeDelay()
    await fillEditable(titleEl, content.title)
  }
  await pauseBetweenActions()

  const descEl = query<HTMLElement>(sel['upload.description'])
  if (descEl && content.body) {
    await fillEditable(descEl, content.body)
  }
  await pauseBetweenActions()
  if (running?.cancelled) return

  // 4. Submit — đi qua Details → Elements → Checks → Visibility → DONE
  reportStage(taskId, 'submit')
  await clickNextChain(3)

  // Set visibility = Public (default Private)
  const publicRadio = query<HTMLElement>(sel['upload.visibility-public'])
  if (publicRadio) {
    publicRadio.click()
    await pauseBetweenActions()
  }

  const publishBtn = await waitForSelector<HTMLElement>(sel['upload.publish-button'], { timeoutMs: 10_000 })
  publishBtn.click()

  // 5. Verify — chờ confirmation dialog với video URL
  reportStage(taskId, 'verify')
  await sleep(3000)
  // TODO(real-dom): extract real video ID từ ytcp-video-info hoặc location.href
  const mockVideoId = `yt_mock_${Date.now()}`
  reportComplete(
    taskId,
    mockVideoId,
    `https://youtu.be/${mockVideoId}`,
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
