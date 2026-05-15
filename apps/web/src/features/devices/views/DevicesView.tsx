'use client'
import { useState } from 'react'
import { useDevices } from '../hooks/useDevices'
import { DeviceCard } from '../components/DeviceCard'
import { PairCodeDialog } from '../components/PairCodeDialog'

export function DevicesView() {
  const { data, isLoading } = useDevices()
  const [pairOpen, setPairOpen] = useState(false)

  const active = data?.list.filter(a => !a.revokedAt) ?? []

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Thiết bị</h1>
          <p className="text-sm text-muted-foreground">
            Browser extension đã pair với tài khoản. Dùng cho automation publish (TikTok, ...).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPairOpen(true)}
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm text-primary-foreground hover:bg-primary/90"
        >
          + Pair extension
        </button>
      </header>

      {isLoading && <p className="text-muted-foreground">Đang tải...</p>}

      {!isLoading && active.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground">Chưa có thiết bị nào</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cài Chrome extension Sociflow Agent → click <b>+ Pair extension</b> để liên kết.
          </p>
        </div>
      )}

      {active.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {active.map(a => <DeviceCard key={a.id} agent={a} />)}
        </div>
      )}

      <PairCodeDialog open={pairOpen} onClose={() => setPairOpen(false)} />
    </div>
  )
}
