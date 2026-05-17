'use client'
import { useEffect, useState, type FC } from 'react'
import { connectAccountUrl, useAccounts } from '@/features/accounts'

interface StepConnectAccountProps {
  onComplete: () => void
}

type PlatformId = 'youtube' | 'facebook' | 'instagram' | 'tiktok'

interface PlatformOption {
  id: PlatformId
  name: string
  description: string
  color: string
}

const PLATFORMS: PlatformOption[] = [
  { id: 'youtube', name: 'YouTube', description: 'Đăng video, short, livestream', color: 'bg-red-500/10 text-red-500' },
  { id: 'facebook', name: 'Facebook', description: 'Page post, reel, story', color: 'bg-blue-500/10 text-blue-500' },
  { id: 'instagram', name: 'Instagram', description: 'Post, reel, story', color: 'bg-pink-500/10 text-pink-500' },
  { id: 'tiktok', name: 'TikTok', description: 'Video, photo carousel', color: 'bg-zinc-700/20 text-foreground' },
]

export const StepConnectAccount: FC<StepConnectAccountProps> = ({ onComplete }) => {
  const { data, isLoading } = useAccounts()
  const [selected, setSelected] = useState<PlatformId | null>(null)
  const hasAccount = (data?.list?.length ?? 0) > 0

  useEffect(() => {
    if (hasAccount) onComplete()
  }, [hasAccount, onComplete])

  const handleConnect = (platform: PlatformId) => {
    setSelected(platform)
    const url = connectAccountUrl(platform, { returnUrl: '/onboarding?step=compose' })
    window.location.href = url
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Kết nối nền tảng đầu tiên</h2>
        <p className="mt-2 text-muted-foreground">
          Chọn nền tảng bạn muốn đăng bài. Bạn sẽ được chuyển sang trang đăng nhập của nền tảng để cấp quyền.
        </p>
      </div>

      {hasAccount && (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm">
          <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
              <path d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L4 10.4a1 1 0 011.4-1.4l3.1 3.1 6.8-6.8a1 1 0 011.4 0z" />
            </svg>
          </span>
          <div>
            <p className="font-medium text-foreground">Đã kết nối {data?.list?.length} tài khoản</p>
            <p className="text-muted-foreground">Bạn có thể tiếp tục bước tiếp theo hoặc kết nối thêm.</p>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {PLATFORMS.map((platform) => (
          <button
            key={platform.id}
            type="button"
            onClick={() => handleConnect(platform.id)}
            disabled={isLoading || selected === platform.id}
            className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-md disabled:cursor-wait disabled:opacity-60"
          >
            <span className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-lg font-bold ${platform.color}`}>
              {platform.name[0]}
            </span>
            <div className="flex-1">
              <div className="font-semibold">{platform.name}</div>
              <div className="text-sm text-muted-foreground">{platform.description}</div>
            </div>
            <span className="text-sm text-muted-foreground transition-transform group-hover:translate-x-1">
              {selected === platform.id ? '...' : '→'}
            </span>
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Token được mã hóa AES-256-GCM. Bạn có thể ngắt kết nối bất cứ lúc nào trong Cài đặt.
      </p>
    </div>
  )
}
