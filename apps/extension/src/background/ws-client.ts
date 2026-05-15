/// <reference types="chrome" />

/**
 * Socket.io client cho extension agent.
 *
 * - Connect tới wsUrl/agents với agentToken
 * - Validate inbound message qua zod schema
 * - Exponential backoff reconnect: 5s, 10s, 30s, 60s, max 300s
 */

import { io, type Socket } from 'socket.io-client'
import {
  type AgentToServerMessage,
  PublishCommandSchema,
  CancelTaskCommandSchema,
  PingCommandSchema,
} from '@sociflow/ws-protocol'
import type { AgentCredentials } from './storage'
import { dispatchPublish, cancelTask, getActiveTabsCount } from './task-dispatcher'

const CAPABILITIES = ['tiktok', 'facebook', 'instagram', 'youtube']
const RECONNECT_DELAYS_MS = [5_000, 10_000, 30_000, 60_000, 300_000]

let socket: Socket | null = null
let credentials: AgentCredentials | null = null
let reconnectAttempt = 0
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let connected = false

function getReconnectDelay(): number {
  const idx = Math.min(reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)
  return RECONNECT_DELAYS_MS[idx]
}

function setBadge(text: string, color: string) {
  chrome.action.setBadgeText({ text }).catch(() => {})
  chrome.action.setBadgeBackgroundColor({ color }).catch(() => {})
}

function broadcastStatus() {
  chrome.runtime.sendMessage({ type: 'WS_STATUS_CHANGED', connected }).catch(() => {})
}

function bindServerMessages(s: Socket) {
  s.on('s2a:ping', (raw: unknown) => {
    const parsed = PingCommandSchema.safeParse(raw)
    if (!parsed.success) {
      console.warn('[sociflow-agent] invalid s2a:ping payload')
      return
    }
    sendToServer({
      type: 'a2s:pong',
      ts: Date.now(),
      capabilities: CAPABILITIES,
    })
  })

  s.on('s2a:publish', async (raw: unknown) => {
    const parsed = PublishCommandSchema.safeParse(raw)
    if (!parsed.success) {
      console.warn('[sociflow-agent] invalid s2a:publish payload', parsed.error.issues)
      return
    }
    const command = parsed.data
    sendToServer({ type: 'a2s:ack', taskId: command.taskId })

    try {
      await dispatchPublish(command)
    }
    catch (err) {
      const reason = err instanceof Error ? err.message : 'dispatch failed'
      sendToServer({
        type: 'a2s:failed',
        taskId: command.taskId,
        reason,
        recoverable: false,
      })
    }
  })

  s.on('s2a:cancel', async (raw: unknown) => {
    const parsed = CancelTaskCommandSchema.safeParse(raw)
    if (!parsed.success) {
      console.warn('[sociflow-agent] invalid s2a:cancel payload')
      return
    }
    await cancelTask(parsed.data.taskId)
  })
}

function bindLifecycle(s: Socket) {
  s.on('connect', () => {
    connected = true
    reconnectAttempt = 0
    setBadge('ON', '#16a34a')
    broadcastStatus()
    console.warn('[sociflow-agent] WS connected', s.id)
  })

  s.on('disconnect', (reason) => {
    connected = false
    setBadge('OFF', '#dc2626')
    broadcastStatus()
    console.warn('[sociflow-agent] WS disconnected:', reason)
    scheduleReconnect()
  })

  s.on('connect_error', (err) => {
    console.warn('[sociflow-agent] WS connect_error:', err.message)
    connected = false
    setBadge('ERR', '#dc2626')
    broadcastStatus()
    scheduleReconnect()
  })
}

function scheduleReconnect() {
  if (reconnectTimer || !credentials) return
  const delay = getReconnectDelay()
  reconnectAttempt++
  console.warn(`[sociflow-agent] reconnect attempt ${reconnectAttempt} in ${delay}ms`)
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    if (credentials) {
      connectInternal(credentials)
    }
  }, delay)
}

function connectInternal(creds: AgentCredentials) {
  if (socket) {
    try { socket.disconnect() } catch { /* ignore */ }
    socket = null
  }

  const wsUrl = creds.wsUrl.replace(/\/+$/, '')
  socket = io(`${wsUrl}/agents`, {
    auth: { token: creds.agentToken },
    transports: ['websocket'],
    reconnection: false, // we handle reconnect manually for control
  })

  bindLifecycle(socket)
  bindServerMessages(socket)
}

export function connect(creds: AgentCredentials): void {
  credentials = creds
  reconnectAttempt = 0
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  connectInternal(creds)
}

export function disconnect(): void {
  credentials = null
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (socket) {
    try { socket.disconnect() } catch { /* ignore */ }
    socket = null
  }
  connected = false
  setBadge('', '#000000')
  broadcastStatus()
}

export function sendToServer(message: AgentToServerMessage): void {
  if (!socket?.connected) {
    console.warn('[sociflow-agent] dropping message — not connected:', message.type)
    return
  }
  socket.emit(message.type, message)
}

export function sendHeartbeat(): void {
  sendToServer({
    type: 'a2s:heartbeat',
    ts: Date.now(),
    activeTabsCount: getActiveTabsCount(),
  })
}

export function isConnected(): boolean {
  return connected
}
