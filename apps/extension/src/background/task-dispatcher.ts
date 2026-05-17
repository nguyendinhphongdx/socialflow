/// <reference types="chrome" />

/**
 * Dispatch publish commands tới tab phù hợp dựa trên platform.
 *
 * - Open tab cho upload URL của platform
 * - Wait load complete → send command tới content script
 * - Persist mapping taskId→tabId qua chrome.storage.session (survive SW restart)
 * - Listen chrome.webNavigation: nếu tab redirect khỏi platform domain →
 *   mark `redirected: true` và emit a2s:status `redirected`
 */

import type { PublishCommand, AgentPlatform } from '@sociflow/ws-protocol'
import {
  getTask,
  getTaskByTab,
  listTasks,
  markRedirected,
  putTask,
  removeTaskMapping,
} from '../shared/task-storage'

const UPLOAD_URLS: Record<AgentPlatform, string> = {
  TIKTOK: 'https://www.tiktok.com/upload',
  FACEBOOK: 'https://www.facebook.com/',
  INSTAGRAM: 'https://www.instagram.com/',
  YOUTUBE: 'https://studio.youtube.com/',
}

/**
 * Host pattern hợp lệ cho từng platform — dùng để phát hiện redirect.
 */
const PLATFORM_HOSTS: Record<AgentPlatform, RegExp> = {
  TIKTOK: /(^|\.)tiktok\.com$/,
  FACEBOOK: /(^|\.)facebook\.com$/,
  INSTAGRAM: /(^|\.)instagram\.com$/,
  YOUTUBE: /(^|\.)(youtube\.com|google\.com)$/,
}

type RedirectNotifier = (taskId: string, url: string) => void
let redirectNotifier: RedirectNotifier | null = null

export function setRedirectNotifier(fn: RedirectNotifier): void {
  redirectNotifier = fn
}

function waitForTabLoaded(tabId: number, timeoutMs = 30_000): Promise<void> {
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | null = null

    const cleanup = () => {
      chrome.tabs.onUpdated.removeListener(listener)
      if (timer) clearTimeout(timer)
    }

    const listener = (updatedTabId: number, info: chrome.tabs.TabChangeInfo) => {
      if (updatedTabId === tabId && info.status === 'complete') {
        cleanup()
        resolve()
      }
    }

    chrome.tabs.onUpdated.addListener(listener)

    timer = setTimeout(() => {
      cleanup()
      reject(new Error('tab load timeout'))
    }, timeoutMs)

    // Check current state in case it loaded between listener attach.
    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === 'complete') {
        cleanup()
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

  await putTask({
    taskId: command.taskId,
    tabId: tab.id,
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
  const mapping = await getTask(taskId)
  if (!mapping) return

  try {
    await chrome.tabs.sendMessage(mapping.tabId, { type: 'CANCEL_TASK', taskId }).catch(() => {})
    await chrome.tabs.remove(mapping.tabId).catch(() => {})
  }
  finally {
    await removeTaskMapping(taskId)
  }
}

export async function removeTask(taskId: string): Promise<void> {
  const mapping = await removeTaskMapping(taskId)
  if (!mapping) return
  // Close tab after task done — optional, leave open if user might want to inspect.
  chrome.tabs.remove(mapping.tabId).catch(() => {})
}

export async function getActiveTabsCount(): Promise<number> {
  const all = await listTasks()
  return all.length
}

/**
 * Restore listener cho webNavigation — nếu user/tab redirect khỏi platform
 * domain (vd phishing redirect, login wall), mark task redirected.
 */
export function installNavigationWatcher(): void {
  chrome.webNavigation.onCommitted.addListener(async (details) => {
    if (details.frameId !== 0) return // chỉ care top frame
    const mapping = await getTaskByTab(details.tabId)
    if (!mapping || mapping.redirected) return

    const host = safeHost(details.url)
    if (!host) return
    const pattern = PLATFORM_HOSTS[mapping.platform]
    if (pattern.test(host)) return // vẫn ở platform OK

    await markRedirected(mapping.taskId)
    redirectNotifier?.(mapping.taskId, details.url)
  })

  // Cleanup khi tab bị đóng
  chrome.tabs.onRemoved.addListener(async (tabId) => {
    const mapping = await getTaskByTab(tabId)
    if (!mapping) return
    await removeTaskMapping(mapping.taskId)
  })
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).host
  }
  catch {
    return null
  }
}

/**
 * Khi service worker cold-start, các task pending còn trong storage.session.
 * Trả về danh sách để index.ts decide có cần emit `failed` cho server biết
 * task đã orphan (tab có thể đã closed trong lúc SW suspended).
 */
export async function listOrphanedTasks(): Promise<{ taskId: string, tabAlive: boolean }[]> {
  const tasks = await listTasks()
  const results: { taskId: string, tabAlive: boolean }[] = []
  for (const task of tasks) {
    const tabAlive = await chrome.tabs.get(task.tabId).then(() => true).catch(() => false)
    results.push({ taskId: task.taskId, tabAlive })
  }
  return results
}
