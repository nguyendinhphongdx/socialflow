'use client'
import type { FC } from 'react'
import type { AccountPlatform } from '../types'
import { RECOMMENDED_MODE } from './wizardState'

interface PlatformPickerProps {
  onSelect: (platform: AccountPlatform) => void
}

const PLATFORMS: Array<{
  id: AccountPlatform
  label: string
  description: string
  bg: string
  ring: string
}> = [
  {
    id: 'YOUTUBE',
    label: 'YouTube',
    description: 'Upload video, Shorts, livestream',
    bg: 'bg-red-50 dark:bg-red-950/30',
    ring: 'hover:ring-red-300',
  },
  {
    id: 'FACEBOOK',
    label: 'Facebook',
    description: 'Page post, reel, livestream',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    ring: 'hover:ring-blue-300',
  },
  {
    id: 'INSTAGRAM',
    label: 'Instagram',
    description: 'Feed, reel, story',
    bg: 'bg-pink-50 dark:bg-pink-950/30',
    ring: 'hover:ring-pink-300',
  },
  {
    id: 'TIKTOK',
    label: 'TikTok',
    description: 'Video, livestream',
    bg: 'bg-zinc-100 dark:bg-zinc-900/50',
    ring: 'hover:ring-zinc-400',
  },
]

export const PlatformPicker: FC<PlatformPickerProps> = ({ onSelect }) => {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Chọn platform</h2>
        <p className="text-sm text-muted-foreground">Bước 1/3 — chọn nền tảng để kết nối.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {PLATFORMS.map(p => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p.id)}
            className={`group rounded-lg border border-border p-5 text-left transition hover:ring-2 ${p.bg} ${p.ring}`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{p.label}</h3>
              <span className="text-xs text-muted-foreground">{RECOMMENDED_MODE[p.id]}</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
            <p className="mt-3 text-xs font-medium text-primary opacity-0 transition group-hover:opacity-100">
              Recommended: {RECOMMENDED_MODE[p.id]} mode →
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}
