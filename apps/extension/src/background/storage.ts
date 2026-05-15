/// <reference types="chrome" />

/**
 * Lưu/đọc agent credentials trong chrome.storage.local.
 * KHÔNG dùng chrome.storage.sync (đồng bộ sang device khác — security risk).
 */

export interface AgentCredentials {
  agentToken: string
  agentId: string
  agentPublicId: string
  wsUrl: string
  userId: string
}

const KEYS: (keyof AgentCredentials)[] = [
  'agentToken',
  'agentId',
  'agentPublicId',
  'wsUrl',
  'userId',
]

export async function readCredentials(): Promise<AgentCredentials | null> {
  const r = await chrome.storage.local.get(KEYS)
  if (!r.agentToken || !r.wsUrl) return null
  return r as AgentCredentials
}

export async function clearCredentials(): Promise<void> {
  await chrome.storage.local.remove(KEYS)
}
