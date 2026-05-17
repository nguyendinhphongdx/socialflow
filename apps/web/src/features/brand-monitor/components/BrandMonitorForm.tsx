'use client'
import { useState, type FC, type FormEvent } from 'react'
import type { AccountPlatform } from '@/features/accounts'
import type { BrandMonitor, CreateBrandMonitorInput } from '../types'

interface BrandMonitorFormProps {
  initial?: BrandMonitor
  onSubmit: (input: CreateBrandMonitorInput) => void
  submitting?: boolean
}

const PLATFORM_OPTIONS: AccountPlatform[] = ['YOUTUBE', 'FACEBOOK', 'INSTAGRAM', 'TIKTOK']

export const BrandMonitorForm: FC<BrandMonitorFormProps> = ({ initial, onSubmit, submitting }) => {
  const [name, setName] = useState(initial?.name ?? '')
  const [query, setQuery] = useState(initial?.query ?? '')
  const [platforms, setPlatforms] = useState<AccountPlatform[]>(initial?.platforms ?? ['FACEBOOK'])
  const [pollIntervalMin, setPollIntervalMin] = useState(initial?.pollIntervalMin ?? 60)
  const [enabled, setEnabled] = useState(initial?.enabled ?? true)

  function togglePlatform(p: AccountPlatform) {
    setPlatforms(prev => (prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !query.trim() || platforms.length === 0) return
    onSubmit({ name: name.trim(), query: query.trim(), platforms, pollIntervalMin, enabled })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="bm-name" className="mb-1 block text-sm font-medium">
          Tên monitor
        </label>
        <input
          id="bm-name"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          maxLength={100}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="bm-query" className="mb-1 block text-sm font-medium">
          Keyword / cụm từ cần track
        </label>
        <input
          id="bm-query"
          value={query}
          onChange={e => setQuery(e.target.value)}
          required
          maxLength={200}
          placeholder="vd: sociflow, brand name"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <div>
        <span className="mb-1 block text-sm font-medium">Platform</span>
        <div className="flex flex-wrap gap-2">
          {PLATFORM_OPTIONS.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => togglePlatform(p)}
              className={`rounded-md border px-3 py-1 text-xs ${platforms.includes(p) ? 'border-primary bg-primary/10 text-primary' : 'border-input text-muted-foreground'}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="bm-interval" className="mb-1 block text-sm font-medium">
          Poll interval (phút)
        </label>
        <input
          id="bm-interval"
          type="number"
          min={15}
          max={1440}
          value={pollIntervalMin}
          onChange={e => setPollIntervalMin(Number(e.target.value))}
          className="w-32 rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-muted-foreground">Min 15, max 1440 (24h)</p>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="bm-enabled"
          type="checkbox"
          checked={enabled}
          onChange={e => setEnabled(e.target.checked)}
          className="size-4"
        />
        <label htmlFor="bm-enabled" className="text-sm">Bật polling</label>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {submitting ? 'Đang lưu...' : initial ? 'Cập nhật' : 'Tạo monitor'}
      </button>
    </form>
  )
}
