/// <reference types="chrome" />

/**
 * Screenshot helper cho task failure debugging.
 *
 * Content script không có quyền `chrome.tabs.captureVisibleTab` →
 * gửi message `CAPTURE_SCREENSHOT` tới background → background capture
 * → upload R2 qua BE endpoint `/api/v1/media/upload` (multipart) →
 * trả URL public về cho content script include vào `a2s:failed` payload.
 *
 * Background hiện thực ở `apps/extension/src/background/screenshot.ts`.
 */

export interface ScreenshotResult {
  url: string | null
  error?: string
}

/**
 * Content script API — request background capture + upload.
 * Trả `null` URL nếu fail (không throw, screenshot là best-effort).
 */
export async function captureForFailure(taskId: string): Promise<ScreenshotResult> {
  try {
    const response: ScreenshotResult | undefined = await chrome.runtime.sendMessage({
      type: 'CAPTURE_SCREENSHOT',
      taskId,
    })
    if (!response) return { url: null, error: 'no response' }
    return response
  }
  catch (err) {
    const error = err instanceof Error ? err.message : 'unknown'
    return { url: null, error }
  }
}
