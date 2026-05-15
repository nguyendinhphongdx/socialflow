'use client'
import { useState } from 'react'

interface SchedulePickerProps {
  value: string | null              // ISO string hoặc null = publish now
  onChange: (value: string | null) => void
}

export function SchedulePicker({ value, onChange }: SchedulePickerProps) {
  const [mode, setMode] = useState<'now' | 'later'>(value ? 'later' : 'now')

  function setNow() {
    setMode('now')
    onChange(null)
  }

  function setLater(dt: string) {
    setMode('later')
    // datetime-local input trả về string không có TZ — convert sang ISO
    onChange(new Date(dt).toISOString())
  }

  const minDateTime = new Date(Date.now() + 5 * 60_000).toISOString().slice(0, 16)
  const displayValue = value ? new Date(value).toISOString().slice(0, 16) : ''

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={setNow}
          className={`rounded-md border px-3 py-1.5 text-sm ${mode === 'now' ? 'border-primary bg-accent' : 'border-input hover:bg-accent/50'}`}
        >
          Publish ngay
        </button>
        <button
          type="button"
          onClick={() => setMode('later')}
          className={`rounded-md border px-3 py-1.5 text-sm ${mode === 'later' ? 'border-primary bg-accent' : 'border-input hover:bg-accent/50'}`}
        >
          Lên lịch
        </button>
      </div>
      {mode === 'later' && (
        <input
          type="datetime-local"
          min={minDateTime}
          value={displayValue}
          onChange={e => setLater(e.target.value)}
          className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      )}
    </div>
  )
}
