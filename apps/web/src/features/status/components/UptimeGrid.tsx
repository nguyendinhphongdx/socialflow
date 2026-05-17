import type { FC } from 'react'
import type { UptimeDay } from '../services/status.service'

interface UptimeGridProps {
  days: UptimeDay[]
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }
  catch {
    return iso
  }
}

export const UptimeGrid: FC<UptimeGridProps> = ({ days }) => {
  const totalUptime = days.reduce((acc, d) => acc + d.uptime, 0) / days.length

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h3 className="text-sm font-semibold">Uptime 90 ngày qua</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Tỷ lệ thời gian các dịch vụ chính khả dụng
          </p>
        </div>
        <span className="text-2xl font-bold tabular-nums">{totalUptime.toFixed(2)}%</span>
      </div>

      <div className="flex h-10 items-end gap-[2px]">
        {days.map((day) => {
          const color = day.hasIncident
            ? 'bg-amber-500'
            : day.uptime < 99
              ? 'bg-red-500'
              : 'bg-emerald-500'
          return (
            <div
              key={day.date}
              title={`${formatDate(day.date)} · ${day.uptime.toFixed(1)}%`}
              className={`flex-1 rounded-sm transition-opacity hover:opacity-70 ${color}`}
              style={{ height: '100%' }}
              aria-label={`${formatDate(day.date)}: ${day.uptime.toFixed(1)}% uptime`}
            />
          )
        })}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>{formatDate(days[0]?.date ?? '')}</span>
        <span>{formatDate(days[days.length - 1]?.date ?? '')}</span>
      </div>
    </div>
  )
}
