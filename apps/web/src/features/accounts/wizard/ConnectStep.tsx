'use client'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import type { FC } from 'react'
import {
  oauthCredentialService,
} from '@/features/credentials/services/oauth-credential.service'
import { oauthCredentialKeys } from '@/features/credentials/hooks/useOAuthCredentials'
import { connectAccountUrl } from '../services/accountService'
import type { AccountPlatform, PublishMode } from '../types'

interface ConnectStepProps {
  platform: AccountPlatform
  mode: PublishMode
  onBack: () => void
  onSuccess: () => void
}

const PLATFORM_LOWER: Record<AccountPlatform, 'youtube' | 'facebook' | 'instagram' | 'tiktok'> = {
  YOUTUBE: 'youtube',
  FACEBOOK: 'facebook',
  INSTAGRAM: 'instagram',
  TIKTOK: 'tiktok',
}

const PLATFORM_LABEL: Record<AccountPlatform, string> = {
  YOUTUBE: 'YouTube',
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  TIKTOK: 'TikTok',
}

export const ConnectStep: FC<ConnectStepProps> = ({ platform, mode, onBack, onSuccess }) => {
  const needsOAuth = mode === 'API' || mode === 'HYBRID'
  const needsAgent = mode === 'AUTOMATION' || mode === 'HYBRID'

  const oauthStatus = useQuery({
    queryKey: oauthCredentialKeys.status(platform),
    queryFn: () => oauthCredentialService.status(platform),
    enabled: needsOAuth,
  })

  const statusEntry = oauthStatus.data?.find(s => s.platform === platform)
  const oauthReady = statusEntry && statusEntry.source !== 'NONE' && statusEntry.isActive

  const returnUrl
    = typeof window !== 'undefined'
      ? `${window.location.origin}/dashboard/accounts/new?step=success&platform=${platform}&mode=${mode}`
      : undefined

  const handleOAuthClick = () => {
    // Mark intent so callback page can call onSuccess by reading query string
    onSuccess()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">
            Kết nối {PLATFORM_LABEL[platform]} — {mode} mode
          </h2>
          <p className="text-sm text-muted-foreground">Bước 3/3 — hoàn tất kết nối.</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Quay lại
        </button>
      </div>

      {needsOAuth && (
        <section className="rounded-lg border border-border bg-card p-5">
          <h3 className="font-semibold">OAuth credential</h3>
          {oauthStatus.isLoading && (
            <p className="mt-2 text-sm text-muted-foreground">Đang kiểm tra cấu hình OAuth...</p>
          )}
          {!oauthStatus.isLoading && !oauthReady && (
            <div className="mt-3 space-y-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-900/40 dark:bg-amber-950/30">
              <p className="font-medium text-amber-900 dark:text-amber-100">
                Chưa có OAuth app cho {PLATFORM_LABEL[platform]}
              </p>
              <p className="text-amber-900/80 dark:text-amber-100/80">
                Cần cấu hình OAuth app trước khi connect qua API. Mất ~5-10 phút setup trong platform dev console.
              </p>
              <Link
                href="/dashboard/settings/oauth-credentials"
                className="inline-flex rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
              >
                Cấu hình OAuth app →
              </Link>
            </div>
          )}
          {!oauthStatus.isLoading && oauthReady && (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-muted-foreground">
                Đã có OAuth credential ({statusEntry.source}). Click để bắt đầu OAuth flow.
              </p>
              <a
                href={connectAccountUrl(PLATFORM_LOWER[platform], { returnUrl })}
                onClick={handleOAuthClick}
                className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Connect qua OAuth →
              </a>
            </div>
          )}
        </section>
      )}

      {needsAgent && (
        <section className="rounded-lg border border-border bg-card p-5">
          <h3 className="font-semibold">Browser extension agent</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Automation mode cần extension Sociflow chạy trong browser của bạn.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard/devices"
              className="inline-flex rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              Quản lý agent →
            </Link>
            <a
              href="/extension/download"
              className="inline-flex rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              Install extension
            </a>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Sau khi pair agent, quay lại đây để activate {PLATFORM_LABEL[platform]}.
          </p>
        </section>
      )}

      {mode === 'HYBRID' && (
        <p className="text-xs text-muted-foreground">
          Hybrid: cần hoàn tất cả OAuth + agent ở trên để max reliability.
        </p>
      )}
    </div>
  )
}
