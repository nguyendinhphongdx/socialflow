/// <reference types="chrome" />

/**
 * Facebook content script — Phase 5 stub.
 * Real DOM automation sẽ làm ở Phase 6.
 */

console.warn('[sociflow-agent] facebook content script loaded:', location.href)

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'EXEC_PUBLISH') {
    sendResponse({ ok: false, reason: 'facebook-not-implemented' })
    chrome.runtime.sendMessage({
      type: 'TASK_FAILED',
      taskId: message.command?.taskId,
      reason: 'facebook content script not implemented (Phase 6)',
      recoverable: false,
    }).catch(() => {})
  }
  return false
})
