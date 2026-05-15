/// <reference types="chrome" />

/**
 * Service worker entry — Phase 5.
 *
 * - Đọc agentToken từ chrome.storage.local → connect WS
 * - Heartbeat mỗi 30s qua chrome.alarms (KHÔNG setInterval — SW có thể bị suspend)
 * - Forward messages từ content scripts lên server
 */

import { readCredentials } from './storage'
import {
  connect as wsConnect,
  disconnect as wsDisconnect,
  sendToServer,
  sendHeartbeat,
  isConnected,
} from './ws-client'
import { removeTask } from './task-dispatcher'

const HEARTBEAT_ALARM = 'sociflow-heartbeat'
const HEARTBEAT_PERIOD_MIN = 0.5 // 30s

async function bootstrap(reason: string) {
  console.warn(`[sociflow-agent] bootstrap (${reason})`)
  chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: HEARTBEAT_PERIOD_MIN })

  const creds = await readCredentials()
  if (creds) {
    wsConnect(creds)
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
    sendHeartbeat()
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
      removeTask(message.taskId)
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
      removeTask(message.taskId)
      return false
    }

    default:
      return false
  }
})

// Cold-start service worker — kick bootstrap on script load.
void bootstrap('cold-start')
