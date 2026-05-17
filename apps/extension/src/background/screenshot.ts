/// <reference types="chrome" />

/**
 * Background-side screenshot capture + upload.
 *
 * Content script gửi `CAPTURE_SCREENSHOT` → background:
 *  1. captureVisibleTab() trả về dataURL (PNG)
 *  2. Convert dataURL → Blob
 *  3. POST multipart `/api/v1/media/upload?context=screenshot` với agentToken
 *  4. Trả `{ url }` về content script
 *
 * BE chưa có endpoint screenshot dedicated → tận dụng `/media/upload` chung.
 * Path BE Phase 5 chưa accept agent token directly → có thể chuyển qua
 * `internal` route hoặc agent endpoint riêng (TODO: follow-up khi BE
 * expose `/api/v1/agents/screenshots`).
 */

import { readCredentials } from './storage'

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(',')
  const mimeMatch = meta?.match(/data:([^;]+);base64/)
  const mime = mimeMatch?.[1] ?? 'image/png'
  const binary = atob(base64 ?? '')
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mime })
}

async function uploadToBackend(blob: Blob, taskId: string): Promise<string | null> {
  const creds = await readCredentials()
  if (!creds) return null

  const baseUrl = creds.wsUrl.replace(/^ws/, 'http').replace(/\/+$/, '')
  const url = `${baseUrl}/api/v1/agents/screenshots`

  const form = new FormData()
  form.append('file', blob, `screenshot-${taskId}.png`)
  form.append('taskId', taskId)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${creds.agentToken}` },
      body: form,
    })
    if (!res.ok) {
      console.warn('[sociflow-agent] screenshot upload non-ok', res.status)
      return null
    }
    const body = await res.json().catch(() => null) as { data?: { url?: string } } | null
    return body?.data?.url ?? null
  }
  catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown'
    console.warn('[sociflow-agent] screenshot upload failed:', reason)
    return null
  }
}

export async function captureAndUpload(taskId: string): Promise<{ url: string | null }> {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' })
    if (!dataUrl) return { url: null }
    const blob = dataUrlToBlob(dataUrl)
    const url = await uploadToBackend(blob, taskId)
    return { url }
  }
  catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown'
    console.warn('[sociflow-agent] captureVisibleTab failed:', reason)
    return { url: null }
  }
}
