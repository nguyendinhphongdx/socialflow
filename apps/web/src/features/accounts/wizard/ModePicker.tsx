'use client'
import { useState } from 'react'
import type { FC } from 'react'
import type { AccountPlatform, PublishMode } from '../types'
import { RECOMMENDED_MODE } from './wizardState'

interface ModePickerProps {
  platform: AccountPlatform
  onBack: () => void
  onSelect: (mode: PublishMode) => void
}

interface ModeMeta {
  id: PublishMode
  label: string
  badge: string
  tagline: string
  pros: string[]
  cons: string[]
}

const PLATFORM_LABEL: Record<AccountPlatform, string> = {
  YOUTUBE: 'YouTube',
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  TIKTOK: 'TikTok',
}

const MODES: ModeMeta[] = [
  {
    id: 'API',
    label: 'API mode',
    badge: 'Recommended cho YT, FB, IG',
    tagline: 'OAuth + platform API official',
    pros: ['Ổn định, ít fail', 'Không cần browser mở', 'Server-side scheduling'],
    cons: ['Cần OAuth app (BYOK)', 'Quota platform giới hạn', 'Cần App Review cho prod (workaround: BYOK)'],
  },
  {
    id: 'AUTOMATION',
    label: 'Automation mode',
    badge: 'Recommended cho TT pre-review',
    tagline: 'Chrome extension điều khiển DOM',
    pros: ['Không cần OAuth app', 'Bypass quota platform', 'Hỗ trợ feature mới chưa có API'],
    cons: ['Cần extension chạy + browser mở', 'Platform UI đổi → break', 'Chậm hơn ~3-5x'],
  },
  {
    id: 'HYBRID',
    label: 'Hybrid mode',
    badge: 'Best — max reliability',
    tagline: 'API trước, fallback automation nếu fail',
    pros: ['Resilient nhất', 'Dùng API khi available', 'Automation cover edge case'],
    cons: ['Cần cả OAuth lẫn extension', 'Setup phức tạp hơn'],
  },
]

export const ModePicker: FC<ModePickerProps> = ({ platform, onBack, onSelect }) => {
  const recommended = RECOMMENDED_MODE[platform]
  const [selected, setSelected] = useState<PublishMode>(recommended)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Chọn publish mode cho {PLATFORM_LABEL[platform]}</h2>
          <p className="text-sm text-muted-foreground">Bước 2/3 — recommended: <b>{recommended}</b></p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Quay lại
        </button>
      </div>

      <div className="space-y-3">
        {MODES.map((m) => {
          const isSelected = selected === m.id
          const isRecommended = m.id === recommended
          return (
            <label
              key={m.id}
              className={`flex cursor-pointer flex-col gap-2 rounded-lg border p-4 transition ${
                isSelected
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
                  : 'border-border hover:bg-accent'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="mode"
                  value={m.id}
                  checked={isSelected}
                  onChange={() => setSelected(m.id)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{m.label}</span>
                    {isRecommended && (
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                        {m.badge}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{m.tagline}</p>
                </div>
              </div>
              {isSelected && (
                <div className="mt-2 grid gap-3 border-t border-border pt-3 text-xs sm:grid-cols-2">
                  <div>
                    <p className="font-medium text-emerald-700 dark:text-emerald-300">Ưu điểm</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
                      {m.pros.map(p => <li key={p}>{p}</li>)}
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-amber-700 dark:text-amber-300">Trade-off</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
                      {m.cons.map(c => <li key={c}>{c}</li>)}
                    </ul>
                  </div>
                </div>
              )}
            </label>
          )
        })}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => onSelect(selected)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Tiếp tục →
        </button>
      </div>
    </div>
  )
}
