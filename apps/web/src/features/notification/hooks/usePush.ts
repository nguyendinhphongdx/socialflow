'use client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { pushService } from '../services/pushService'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

export const pushKeys = {
  all: ['push'] as const,
  devices: () => [...pushKeys.all, 'devices'] as const,
}

/**
 * Convert base64-url VAPID public key → Uint8Array (PushManager yêu cầu).
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const buffer = new ArrayBuffer(rawData.length)
  const output = new Uint8Array(buffer)
  for (let i = 0; i < rawData.length; i += 1) output[i] = rawData.charCodeAt(i)
  return output
}

export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function isVapidConfigured(): boolean {
  return VAPID_PUBLIC_KEY.length > 0
}

async function registerSw(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration('/push-sw.js')
  if (existing) return existing
  return navigator.serviceWorker.register('/push-sw.js', { scope: '/' })
}

export function useSubscribeToPush() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (deviceTag?: string) => {
      if (!isPushSupported()) {
        throw new Error('Trình duyệt không hỗ trợ Web Push')
      }
      if (!isVapidConfigured()) {
        throw new Error('VAPID public key chưa cấu hình (NEXT_PUBLIC_VAPID_PUBLIC_KEY)')
      }

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        throw new Error('Quyền thông báo bị từ chối')
      }

      const registration = await registerSw()
      // Subscribe — nếu đã có subscription thì reuse.
      const existing = await registration.pushManager.getSubscription()
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      const raw = subscription.toJSON() as { endpoint?: string, keys?: { p256dh?: string, auth?: string } }
      if (!raw.endpoint || !raw.keys?.p256dh || !raw.keys?.auth) {
        throw new Error('Subscription thiếu thông tin keys')
      }

      return pushService.subscribe({
        endpoint: raw.endpoint,
        keys: { p256dh: raw.keys.p256dh, auth: raw.keys.auth },
        deviceTag,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pushKeys.all })
      toast.success('Đã bật thông báo trên thiết bị này')
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? 'Bật thông báo thất bại')
    },
  })
}

export function usePushDevices() {
  return useQuery({
    queryKey: pushKeys.devices(),
    queryFn: pushService.list,
    enabled: isPushSupported(),
  })
}

export function useUnsubscribePush() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await pushService.unsubscribe(id)
      // Best-effort cleanup browser-side subscription
      if (isPushSupported()) {
        const registration = await navigator.serviceWorker.getRegistration('/push-sw.js')
        const sub = await registration?.pushManager.getSubscription()
        await sub?.unsubscribe().catch(() => undefined)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pushKeys.all })
      toast.success('Đã tắt thông báo')
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message ?? 'Tắt thông báo thất bại')
    },
  })
}
