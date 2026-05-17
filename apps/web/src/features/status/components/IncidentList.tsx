import type { FC } from 'react'
import type { IncidentEntry } from '../services/status.service'

interface IncidentListProps {
  incidents: IncidentEntry[]
}

const SEVERITY_BADGE: Record<IncidentEntry['severity'], { color: string, label: string }> = {
  resolved: { color: 'bg-emerald-500/10 text-emerald-500', label: 'Đã xử lý' },
  monitoring: { color: 'bg-blue-500/10 text-blue-500', label: 'Đang theo dõi' },
  investigating: { color: 'bg-amber-500/10 text-amber-500', label: 'Đang điều tra' },
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' })
  }
  catch {
    return iso
  }
}

export const IncidentList: FC<IncidentListProps> = ({ incidents }) => {
  if (incidents.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Không có sự cố nào trong 90 ngày qua.
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {incidents.map((incident) => {
        const badge = SEVERITY_BADGE[incident.severity]
        return (
          <li key={incident.id} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{incident.title}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.color}`}>
                    {badge.label}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{incident.description}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatDate(incident.date)}
              </span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
