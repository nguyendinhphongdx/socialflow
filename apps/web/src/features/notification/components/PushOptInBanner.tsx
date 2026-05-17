'use client'
import { useEffect, useState } from 'react'
import {
  isPushSupported,
  isVapidConfigured,
  useSubscribeToPush,
} from '../hooks/usePush'

const DISMISSED_KEY = 'sf_push_opt_in_dismissed'

/**
 * Banner hỏi user bật push notification 1 lần sau login.
 * Tự ẩn nếu:
 *  - Trình duyệt không support
 *  - VAPID chưa cấu hình
 *  - User đã grant/deny permission rồi (Notification.permission ≠ 'default')
 *  - User đã dismiss banner (localStorage)
 */
export function PushOptInBanner() {
  const [visible, setVisible] = useState(false)
  const subscribe = useSubscribeToPush()

  useEffect(() => {
    if (!isPushSupported() || !isVapidConfigured()) return
    if (Notification.permission !== 'default') return
    if (typeof localStorage !== 'undefined' && localStorage.getItem(DISMISSED_KEY) === '1') return
    setVisible(true)
  }, [])

  if (!visible) return null

  function dismiss() {
    if (typeof localStorage !== 'undefined') localStorage.setItem(DISMISSED_KEY, '1')
    setVisible(false)
  }

  function onEnable() {
    subscribe.mutate(undefined, {
      onSettled: () => dismiss(),
    })
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <p className="font-semibold">Bật thông báo comment mới?</p>
          <p className="text-sm text-muted-foreground">
            Nhận push notification ngay khi có comment cần trả lời. Có thể tắt sau ở Settings.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={dismiss}
            className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent"
            disabled={subscribe.isPending}
          >
            Để sau
          </button>
          <button
            type="button"
            onClick={onEnable}
            disabled={subscribe.isPending}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {subscribe.isPending ? 'Đang bật...' : 'Bật thông báo'}
          </button>
        </div>
      </div>
    </div>
  )
}
