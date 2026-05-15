/// <reference types="chrome" />

/**
 * Popup script — pair flow.
 *
 * Flow:
 * 1. User nhập 6-digit code
 * 2. POST /api/v1/agents/pair/claim → server trả agentToken + wsUrl
 * 3. Lưu vào chrome.storage.local + báo background connect WS
 * 4. Hiển thị trạng thái paired + disconnect button
 */

import type { PairClaimRequest, PairClaimResponse } from '@sociflow/ws-protocol'

const API_BASE = 'http://localhost:3000/api/v1'
const PAIR_ENDPOINT = `${API_BASE}/agents/pair/claim`

interface StoredAgent {
  agentToken: string
  agentId: string
  agentPublicId: string
  wsUrl: string
  userId: string
}

interface ResponseEnvelope<T> {
  data: T
  code: number
  message: string
  timestamp: number
}

function detectOs(): string {
  const ua = navigator.userAgent
  if (ua.includes('Win')) return 'Windows'
  if (ua.includes('Mac')) return 'macOS'
  if (ua.includes('Linux')) return 'Linux'
  if (ua.includes('CrOS')) return 'ChromeOS'
  return 'Unknown'
}

function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id)
  if (!el) throw new Error(`Element #${id} not found`)
  return el as T
}

function showError(message: string) {
  const errEl = $<HTMLDivElement>('pair-error')
  errEl.textContent = message
  errEl.classList.remove('hidden')
}

function hideError() {
  $<HTMLDivElement>('pair-error').classList.add('hidden')
}

function renderUnpaired() {
  $('state-unpaired').classList.remove('hidden')
  $('state-paired').classList.add('hidden')
  const input = $<HTMLInputElement>('pair-code')
  input.value = ''
  input.focus()
}

function renderPaired(stored: StoredAgent, wsConnected: boolean) {
  $('state-unpaired').classList.add('hidden')
  $('state-paired').classList.remove('hidden')
  $('info-agent-id').textContent = stored.agentPublicId
  $('info-ws-url').textContent = stored.wsUrl
  setWsStatus(wsConnected ? 'connected' : 'connecting')
}

function setWsStatus(status: 'connected' | 'connecting' | 'disconnected') {
  const el = $<HTMLSpanElement>('ws-status')
  el.classList.remove('status--idle', 'status--ok', 'status--err')
  switch (status) {
    case 'connected':
      el.textContent = 'Đã kết nối'
      el.classList.add('status--ok')
      break
    case 'connecting':
      el.textContent = 'Đang kết nối...'
      el.classList.add('status--idle')
      break
    case 'disconnected':
      el.textContent = 'Mất kết nối'
      el.classList.add('status--err')
      break
  }
}

async function getStoredAgent(): Promise<StoredAgent | null> {
  const r = await chrome.storage.local.get(['agentToken', 'agentId', 'agentPublicId', 'wsUrl', 'userId'])
  if (!r.agentToken) return null
  return r as StoredAgent
}

async function claimPair(pairCode: string): Promise<PairClaimResponse> {
  const manifest = chrome.runtime.getManifest()
  const body: PairClaimRequest = {
    pairCode,
    deviceInfo: {
      os: detectOs(),
      browserName: 'Chrome',
      extensionVersion: manifest.version,
      capabilities: ['tiktok', 'facebook', 'instagram', 'youtube'],
    },
  }

  const res = await fetch(PAIR_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const json = (await res.json()) as ResponseEnvelope<PairClaimResponse>
  if (!res.ok || json.code !== 0) {
    throw new Error(json.message || `HTTP ${res.status}`)
  }
  return json.data
}

async function handlePairSubmit(ev: Event) {
  ev.preventDefault()
  hideError()
  const input = $<HTMLInputElement>('pair-code')
  const submitBtn = $<HTMLButtonElement>('pair-submit')
  const code = input.value.trim()

  if (!/^\d{6}$/.test(code)) {
    showError('Mã phải là 6 chữ số')
    return
  }

  submitBtn.disabled = true
  submitBtn.textContent = 'Đang liên kết...'
  try {
    const response = await claimPair(code)
    const stored: StoredAgent = {
      agentToken: response.agentToken,
      agentId: response.agentId,
      agentPublicId: response.agentPublicId,
      wsUrl: response.wsUrl,
      userId: response.userId,
    }
    await chrome.storage.local.set(stored)
    await chrome.runtime.sendMessage({ type: 'PAIRED' }).catch(() => {})
    renderPaired(stored, false)
    void refreshWsStatus()
  }
  catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi không xác định'
    showError(message)
  }
  finally {
    submitBtn.disabled = false
    submitBtn.textContent = 'Liên kết'
  }
}

async function handleDisconnect() {
  await chrome.storage.local.remove(['agentToken', 'agentId', 'agentPublicId', 'wsUrl', 'userId'])
  await chrome.runtime.sendMessage({ type: 'UNPAIRED' }).catch(() => {})
  renderUnpaired()
}

async function refreshWsStatus() {
  try {
    const res = await chrome.runtime.sendMessage({ type: 'GET_WS_STATUS' })
    if (res && typeof res === 'object' && 'connected' in res) {
      setWsStatus((res as { connected: boolean }).connected ? 'connected' : 'connecting')
    }
  }
  catch {
    setWsStatus('disconnected')
  }
}

function attachListeners() {
  $<HTMLFormElement>('pair-form').addEventListener('submit', handlePairSubmit)
  $<HTMLButtonElement>('disconnect-btn').addEventListener('click', handleDisconnect)

  const input = $<HTMLInputElement>('pair-code')
  input.addEventListener('input', () => {
    input.value = input.value.replace(/\D/g, '').slice(0, 6)
  })

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'WS_STATUS_CHANGED') {
      setWsStatus(msg.connected ? 'connected' : 'disconnected')
    }
    return false
  })
}

document.addEventListener('DOMContentLoaded', async () => {
  attachListeners()
  const stored = await getStoredAgent()
  if (stored) {
    renderPaired(stored, false)
    void refreshWsStatus()
  }
  else {
    renderUnpaired()
  }
})
