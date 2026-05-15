/// <reference types="chrome" />

/**
 * Dispatch publish commands tới tab phù hợp dựa trên platform.
 *
 * - Open tab cho upload URL của platform
 * - Wait load complete → send command tới content script
 * - Track mapping taskId → tabId in-memory (sẽ mất khi SW restart — Phase 5 acceptable)
 */

import type { PublishCommand } from '@sociflow/ws-protocol'

interface TaskTabMapping {
  tabId: number
  taskId: string
  platform: PublishCommand['platform']
  startedAt: number
}

const taskTabs = new Map<string, TaskTabMapping>()

const UPLOAD_URLS: Record<PublishCommand['platform'], string> = {
  TIKTOK: 'https://www.tiktok.com/upload',
  FACEBOOK: 'https://www.facebook.com/',
  INSTAGRAM: 'https://www.instagram.com/',
  YOUTUBE: 'https://studio.youtube.com/channel/UC/videos/upload',
}

function waitForTabLoaded(tabId: number, timeoutMs = 30_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const listener = (updatedTabId: number, info: chrome.tabs.TabChangeInfo) => {
      if (updatedTabId === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener)
        resolve()
      }
    }
    chrome.tabs.onUpdated.addListener(listener)

    const timer = setInterval(() => {
      if (Date.now() - start > timeoutMs) {
        clearInterval(timer)
        chrome.tabs.onUpdated.removeListener(listener)
        reject(new Error('tab load timeout'))
      }
    }, 1000)

    // Check current state in case it loaded between listener attach.
    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === 'complete') {
        clearInterval(timer)
        chrome.tabs.onUpdated.removeListener(listener)
        resolve()
      }
    }).catch(() => {})
  })
}

export async function dispatchPublish(command: PublishCommand): Promise<void> {
  const uploadUrl = UPLOAD_URLS[command.platform]
  if (!uploadUrl) {
    throw new Error(`Unsupported platform: ${command.platform}`)
  }

  const tab = await chrome.tabs.create({ url: uploadUrl, active: false })
  if (typeof tab.id !== 'number') {
    throw new Error('Failed to open tab')
  }

  taskTabs.set(command.taskId, {
    tabId: tab.id,
    taskId: command.taskId,
    platform: command.platform,
    startedAt: Date.now(),
  })

  await waitForTabLoaded(tab.id)

  await chrome.tabs.sendMessage(tab.id, {
    type: 'EXEC_PUBLISH',
    command,
  })
}

export async function cancelTask(taskId: string): Promise<void> {
  const mapping = taskTabs.get(taskId)
  if (!mapping) return

  try {
    await chrome.tabs.sendMessage(mapping.tabId, { type: 'CANCEL_TASK', taskId }).catch(() => {})
    await chrome.tabs.remove(mapping.tabId).catch(() => {})
  }
  finally {
    taskTabs.delete(taskId)
  }
}

export function removeTask(taskId: string): void {
  const mapping = taskTabs.get(taskId)
  if (!mapping) return
  // Close tab after task done — keep optional, may want to keep for inspection.
  chrome.tabs.remove(mapping.tabId).catch(() => {})
  taskTabs.delete(taskId)
}

export function getActiveTabsCount(): number {
  return taskTabs.size
}
