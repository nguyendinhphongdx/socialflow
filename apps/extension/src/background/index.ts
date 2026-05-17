/// <reference types="chrome" />

/**
 * Service worker entry — Phase 5 polish.
 *
 * - Đọc agentToken từ chrome.storage.local → connect WS
 * - Heartbeat mỗi 30s qua chrome.alarms (KHÔNG setInterval — SW có thể bị suspend)
 * - Forward messages từ content scripts lên server
 * - Install navigation watcher cho redirect detection
 * - Restore task mappings từ storage.session khi SW cold-start
 */

import { readCredentials } from './storage'
import {
  connect as wsConnect,
  disconnect as wsDisconnect,
  sendToServer,
  sendHeartbeat,
  isConnected,
} from './ws-client'
import {
  installNavigationWatcher,
  listOrphanedTasks,
  removeTask,
} from './task-dispatcher'
import { captureAndUpload } from './screenshot'

const HEARTBEAT_ALARM = 'sociflow-heartbeat'
const HEARTBEAT_PERIOD_MIN = 0.5 // 30s

let navigationWatcherInstalled = false

async function bootstrap(reason: string) {
  console.warn(`[sociflow-agent] bootstrap (${reason})`)
  chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: HEARTBEAT_PERIOD_MIN })

  if (!navigationWatcherInstalled) {
    installNavigationWatcher()
    navigationWatcherInstalled = true
  }

  const creds = await readCredentials()
  if (creds) {
    wsConnect(creds)
  }

  // Sweep orphan tasks — nếu tab đã bị đóng trong lúc SW suspend, báo server
  // failed để task không kẹt trong PENDING.
  await sweepOrphanedTasks()
}

async function sweepOrphanedTasks(): Promise<void> {
  const orphans = await listOrphanedTasks()
  for (const item of orphans) {
    if (item.tabAlive) continue
    sendToServer({
      type: 'a2s:failed',
      taskId: item.taskId,
      reason: 'tab_closed_during_sw_suspend',
      recoverable: true,
      screenshotUrl: null,
    })
    await removeTask(item.taskId)
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  void bootstrap(`installed:${details.reason}`)
})

chrome.runtime.onStartup.addListener(() => {
  void bootstrap('startup')
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === HEARTBEAT_ALARM && isConnected()) {
    void sendHeartbeat()
  }
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
    return false
  }

  switch (message.type) {
    case 'PAIRED': {
      void (async () => {
        const creds = await readCredentials()
        if (creds) wsConnect(creds)
        sendResponse({ ok: true })
      })()
      return true
    }

    case 'UNPAIRED': {
      wsDisconnect()
      sendResponse({ ok: true })
      return false
    }

    case 'GET_WS_STATUS': {
      sendResponse({ connected: isConnected() })
      return false
    }

    case 'TASK_STATUS': {
      sendToServer({
        type: 'a2s:status',
        taskId: message.taskId,
        stage: message.stage,
        progress: message.progress,
      })
      return false
    }

    case 'TASK_COMPLETE': {
      sendToServer({
        type: 'a2s:complete',
        taskId: message.taskId,
        platformPostId: message.platformPostId,
        workLink: message.workLink,
      })
      void removeTask(message.taskId)
      return false
    }

    case 'TASK_FAILED': {
      sendToServer({
        type: 'a2s:failed',
        taskId: message.taskId,
        reason: message.reason,
        recoverable: message.recoverable ?? false,
        screenshotUrl: message.screenshotUrl ?? null,
      })
      void removeTask(message.taskId)
      return false
    }

    case 'CAPTURE_SCREENSHOT': {
      void (async () => {
        const result = await captureAndUpload(message.taskId ?? 'unknown')
        sendResponse(result)
      })()
      return true
    }

    default:
      return false
  }
})

// Cold-start service worker — kick bootstrap on script load.
void bootstrap('cold-start')
