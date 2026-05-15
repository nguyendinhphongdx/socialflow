'use client'
import { useEffect, useState } from 'react'
import { useInitPair } from '../hooks/useDevices'

interface PairCodeDialogProps {
  open: boolean
  onClose: () => void
}

export function PairCodeDialog({ open, onClose }: PairCodeDialogProps) {
  const initPair = useInitPair()
  const [remaining, setRemaining] = useState(0)

  useEffect(() => {
    if (!open) return
    initPair.mutate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!initPair.data?.expiresAt) return
    const update = () => {
      const ms = new Date(initPair.data!.expiresAt).getTime() - Date.now()
      setRemaining(Math.max(0, Math.floor(ms / 1000)))
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [initPair.data?.expiresAt])

  if (!open) return null

  const expired = remaining === 0 && !initPair.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Pair extension</h2>
          <button type="button" onClick={onClose} className="text-2xl text-muted-foreground">×</button>
        </header>

        <ol className="mb-4 list-decimal pl-5 text-sm text-muted-foreground">
          <li>Mở Sociflow Agent extension trong Chrome</li>
          <li>Nhập mã 6 chữ số dưới đây</li>
          <li>Click <b>Liên kết</b> trong popup</li>
        </ol>

        {initPair.isPending && (
          <div className="rounded-lg border-2 border-dashed border-border p-8 text-center text-muted-foreground">
            Đang tạo mã...
          </div>
        )}

        {initPair.data && !expired && (
          <div className="space-y-3 text-center">
            <p className="text-xs text-muted-foreground">Mã của bạn (hết hạn sau {remaining}s)</p>
            <p className="font-mono text-5xl font-bold tracking-widest text-primary">
              {initPair.data.pairCode}
            </p>
            <p className="text-xs text-muted-foreground">Agent ID: {initPair.data.agentPublicId}</p>
          </div>
        )}

        {expired && (
          <div className="space-y-3 text-center">
            <p className="text-sm text-destructive">Mã đã hết hạn</p>
            <button
              type="button"
              onClick={() => initPair.mutate()}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
            >
              Tạo mã mới
            </button>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button type="button" onClick={onClose} className="rounded-md border border-input px-4 py-2 text-sm hover:bg-accent">
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
