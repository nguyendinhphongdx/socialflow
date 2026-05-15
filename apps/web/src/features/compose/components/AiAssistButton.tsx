'use client'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useAiCaption } from '../hooks/useAiCaption'
import type { AiPlatform, GenerateCaptionResult } from '../services/aiService'

interface AiAssistButtonProps {
  platform?: AiPlatform
  onResult: (result: GenerateCaptionResult) => void
}

const TONES: Array<{ value: 'professional' | 'casual' | 'funny', label: string }> = [
  { value: 'casual', label: 'Thân thiện' },
  { value: 'professional', label: 'Chuyên nghiệp' },
  { value: 'funny', label: 'Hài hước' },
]

const PLATFORMS: AiPlatform[] = ['YOUTUBE', 'FACEBOOK', 'INSTAGRAM', 'TIKTOK']

export function AiAssistButton({ platform, onResult }: AiAssistButtonProps) {
  const [open, setOpen] = useState(false)
  const [topic, setTopic] = useState('')
  const [tone, setTone] = useState<'professional' | 'casual' | 'funny'>('casual')
  const [selectedPlatform, setSelectedPlatform] = useState<AiPlatform>(platform ?? 'FACEBOOK')
  const [includeHashtags, setIncludeHashtags] = useState(true)
  const popoverRef = useRef<HTMLDivElement>(null)

  const gen = useAiCaption()

  useEffect(() => {
    if (platform) setSelectedPlatform(platform)
  }, [platform])

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = topic.trim()
    if (trimmed.length < 3) {
      toast.error('Topic cần ít nhất 3 ký tự')
      return
    }
    gen.mutate(
      {
        topic: trimmed,
        platform: selectedPlatform,
        tone,
        includeHashtags,
        languageCode: 'vi',
      },
      {
        onSuccess: (result) => {
          onResult(result)
          setOpen(false)
          toast.success(`Đã sinh caption · còn ${result.creditsRemaining} credit`)
        },
      },
    )
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs hover:bg-accent"
      >
        <span>✨</span>
        <span>AI Generate</span>
      </button>

      {open && (
        <div
          ref={popoverRef}
          className="absolute right-0 z-20 mt-2 w-80 rounded-lg border border-border bg-popover p-4 shadow-lg"
        >
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium" htmlFor="ai-topic">Chủ đề</label>
              <textarea
                id="ai-topic"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="VD: ra mắt khoá học SEO 2026, giảm 30%..."
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium" htmlFor="ai-tone">Tone</label>
              <select
                id="ai-tone"
                value={tone}
                onChange={e => setTone(e.target.value as 'professional' | 'casual' | 'funny')}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
              >
                {TONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium" htmlFor="ai-platform">Platform</label>
              <select
                id="ai-platform"
                value={selectedPlatform}
                onChange={e => setSelectedPlatform(e.target.value as AiPlatform)}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
              >
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={includeHashtags}
                onChange={e => setIncludeHashtags(e.target.checked)}
              />
              Thêm hashtag
            </label>

            <div className="flex gap-2 border-t border-border pt-3">
              <button
                type="submit"
                disabled={gen.isPending}
                className="inline-flex h-8 flex-1 items-center justify-center rounded-md bg-primary px-3 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {gen.isPending ? 'Đang sinh...' : 'Sinh caption (-1 credit)'}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-8 items-center justify-center rounded-md border border-input px-3 text-xs hover:bg-accent"
              >
                Huỷ
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
