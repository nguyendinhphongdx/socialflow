import type { FC } from 'react'
import type { SystemStatus, SystemStatusResult } from '../services/status.service'

interface StatusBannerProps {
  result: SystemStatusResult
}

const STATUS_STYLES: Record<SystemStatus, { dot: string, bg: string, label: string }> = {
  operational: {
    dot: 'bg-emerald-500',
    bg: 'border-emerald-500/30 bg-emerald-500/5',
    label: 'All systems operational',
  },
  degraded: {
    dot: 'bg-amber-500',
    bg: 'border-amber-500/30 bg-amber-500/5',
    label: 'Partial degradation',
  },
  down: {
    dot: 'bg-red-500',
    bg: 'border-red-500/30 bg-red-500/5',
    label: 'Major outage',
  },
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Asia/Ho_Chi_Minh',
    })
  }
  catch {
    return iso
  }
}

export const StatusBanner: FC<StatusBannerProps> = ({ result }) => {
  const style = STATUS_STYLES[result.status]
  return (
    <div className={`rounded-xl border p-6 ${style.bg}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className={`inline-block h-3 w-3 animate-pulse rounded-full ${style.dot}`} />
          <div>
            <h2 className="text-xl font-semibold">{style.label}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{result.message}</p>
          </div>
        </div>
        <span className="text-xs text-muted-foreground">
          Cập nhật: {formatTime(result.checkedAt)}
        </span>
      </div>
    </div>
  )
}
