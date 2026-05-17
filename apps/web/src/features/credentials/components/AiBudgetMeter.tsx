import type { FC } from 'react'

interface AiBudgetMeterProps {
  spent: number
  budget: number | null
}

export const AiBudgetMeter: FC<AiBudgetMeterProps> = ({ spent, budget }) => {
  if (!budget || budget <= 0) {
    return (
      <div className="text-xs text-muted-foreground">
        Đã dùng: ${spent.toFixed(2)} · không giới hạn budget
      </div>
    )
  }
  const pct = Math.min(100, Math.round((spent / budget) * 100))
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span>${spent.toFixed(2)} / ${budget.toFixed(2)}</span>
        <span className="text-muted-foreground">{pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
