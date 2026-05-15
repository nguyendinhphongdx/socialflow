'use client'
import type { FC } from 'react'

interface MetricCardProps {
  label: string
  value: number | string
  delta?: number | null
  format?: 'number' | 'percent'
}

function formatNumber(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export const MetricCard: FC<MetricCardProps> = ({ label, value, delta, format = 'number' }) => {
  const display = typeof value === 'number'
    ? (format === 'percent' ? `${(value * 100).toFixed(1)}%` : formatNumber(value))
    : value

  const deltaColor = delta == null
    ? ''
    : delta > 0
      ? 'bg-green-100 text-green-800'
      : delta < 0
        ? 'bg-red-100 text-red-800'
        : 'bg-gray-100 text-gray-800'

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{display}</p>
      {delta != null && (
        <span className={`mt-2 inline-block rounded px-1.5 py-0.5 text-xs ${deltaColor}`}>
          {delta > 0 ? '+' : ''}{formatNumber(delta)}
        </span>
      )}
    </div>
  )
}
