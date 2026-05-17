/// <reference types="chrome" />

/**
 * Persist task↔tab mapping vào chrome.storage.session.
 *
 * MV3 service worker có thể bị suspend bất kỳ lúc nào. Nếu chỉ giữ
 * `Map` in-memory, restart SW = mất hết → khi server resend task hoặc
 * tab event tới (webNavigation, tabs.onRemoved) không biết task nào.
 *
 * chrome.storage.session: cleared khi browser restart (đúng nhu cầu —
 * task crash-recovery chỉ valid trong session hiện tại).
 */

import type { AgentPlatform } from '@sociflow/ws-protocol'

const STORAGE_KEY = 'sociflow:active-tasks'

export interface TaskMapping {
  taskId: string
  tabId: number
  platform: AgentPlatform
  startedAt: number
  redirected?: boolean
}

type StorageShape = Record<string, TaskMapping>

async function readAll(): Promise<StorageShape> {
  // chrome.storage.session yêu cầu permission "storage" — đã declared.
  const result = await chrome.storage.session.get(STORAGE_KEY)
  const raw = result[STORAGE_KEY]
  if (!raw || typeof raw !== 'object') return {}
  return raw as StorageShape
}

async function writeAll(mapping: StorageShape): Promise<void> {
  await chrome.storage.session.set({ [STORAGE_KEY]: mapping })
}

export async function putTask(task: TaskMapping): Promise<void> {
  const all = await readAll()
  all[task.taskId] = task
  await writeAll(all)
}

export async function getTask(taskId: string): Promise<TaskMapping | null> {
  const all = await readAll()
  return all[taskId] ?? null
}

export async function getTaskByTab(tabId: number): Promise<TaskMapping | null> {
  const all = await readAll()
  for (const key of Object.keys(all)) {
    const mapping = all[key]
    if (mapping.tabId === tabId) return mapping
  }
  return null
}

export async function listTasks(): Promise<TaskMapping[]> {
  const all = await readAll()
  return Object.values(all)
}

export async function removeTaskMapping(taskId: string): Promise<TaskMapping | null> {
  const all = await readAll()
  const existing = all[taskId]
  if (!existing) return null
  delete all[taskId]
  await writeAll(all)
  return existing
}

export async function markRedirected(taskId: string): Promise<void> {
  const all = await readAll()
  const existing = all[taskId]
  if (!existing) return
  existing.redirected = true
  await writeAll(all)
}

export async function clearAllTasks(): Promise<void> {
  await chrome.storage.session.remove(STORAGE_KEY)
}
