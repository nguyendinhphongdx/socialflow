/// <reference types="chrome" />

/**
 * TikTok content script — Phase 5 stub.
 *
 * Nhận `EXEC_PUBLISH` từ background → mô phỏng các stage upload và báo về.
 * Real DOM automation (selectors, Blob → DataTransfer file injection,
 * privacy dropdown, post detection) sẽ làm ở Phase 5 polish.
 */

import type { PublishCommand } from '@sociflow/ws-protocol'

console.warn('[sociflow-agent] tiktok content script loaded:', location.href)

type Stage =
  | 'opening_browser'
  | 'downloading'
  | 'uploading'
  | 'filling_form'
  | 'submitting'

interface RunningTask {
  taskId: string
  cancelled: boolean
}

let running: RunningTask | null = null

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function reportStatus(taskId: string, stage: Stage, progress: number) {
  chrome.runtime.sendMessage({
    type: 'TASK_STATUS',
    taskId,
    stage,
    progress,
  }).catch(() => {})
}

function reportComplete(taskId: string, platformPostId: string, workLink: string) {
  chrome.runtime.sendMessage({
    type: 'TASK_COMPLETE',
    taskId,
    platformPostId,
    workLink,
  }).catch(() => {})
}

function reportFailed(taskId: string, reason: string, recoverable = false) {
  chrome.runtime.sendMessage({
    type: 'TASK_FAILED',
    taskId,
    reason,
    recoverable,
  }).catch(() => {})
}

/**
 * Stub: locate file input và set files. Real flow cần:
 * - fetch(mediaUrl) → Blob
 * - new File([blob], 'video.mp4', { type: blob.type })
 * - DataTransfer.items.add(file) → input.files = dt.files
 * - input.dispatchEvent(new Event('change', { bubbles: true }))
 *
 * Phase 5 polish sẽ test trong DOM thực tế và xử lý TT-specific event flow.
 */
function locateFileInput(): HTMLInputElement | null {
  return document.querySelector<HTMLInputElement>('input[type="file"][accept*="video"]')
}

async function executePublishStub(command: PublishCommand) {
  const { taskId, content } = command

  reportStatus(taskId, 'opening_browser', 5)
  await sleep(500)
  if (running?.cancelled) return

  // Try to detect file input — chỉ log presence, không inject Blob ở Phase 5 stub
  const input = locateFileInput()
  console.warn('[sociflow-agent] tiktok file input found:', Boolean(input))

  reportStatus(taskId, 'downloading', 15)
  await sleep(600)
  if (running?.cancelled) return

  reportStatus(taskId, 'uploading', 30)
  await sleep(800)
  if (running?.cancelled) return

  reportStatus(taskId, 'filling_form', 60)
  await sleep(700)
  if (running?.cancelled) return

  reportStatus(taskId, 'submitting', 90)
  await sleep(500)
  if (running?.cancelled) return

  // Mock complete — Phase 5 polish sẽ wait redirect + extract real video ID
  const mockPostId = `mock_${Date.now()}`
  const mockUsername = content.body?.match(/@(\w+)/)?.[1] ?? 'user'
  reportComplete(
    taskId,
    mockPostId,
    `https://www.tiktok.com/@${mockUsername}/video/${mockPostId}`,
  )
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

    void executePublishStub(command).catch((err) => {
      const reason = err instanceof Error ? err.message : 'unknown error'
      reportFailed(command.taskId, reason)
    }).finally(() => {
      running = null
    })
    return false
  }

  if (message.type === 'CANCEL_TASK' && running) {
    if (running.taskId === message.taskId) {
      running.cancelled = true
      reportFailed(running.taskId, 'cancelled_by_server', false)
    }
    sendResponse({ ok: true })
    return false
  }

  return false
})
