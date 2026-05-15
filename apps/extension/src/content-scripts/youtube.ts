/// <reference types="chrome" />

/**
 * YouTube content script — Phase 5 stub.
 * Real DOM automation sẽ làm ở Phase 6 (YouTube Studio).
 */

console.warn('[sociflow-agent] youtube content script loaded:', location.href)

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'EXEC_PUBLISH') {
    sendResponse({ ok: false, reason: 'youtube-not-implemented' })
    chrome.runtime.sendMessage({
      type: 'TASK_FAILED',
      taskId: message.command?.taskId,
      reason: 'youtube content script not implemented (Phase 6)',
      recoverable: false,
    }).catch(() => {})
  }
  return false
})
