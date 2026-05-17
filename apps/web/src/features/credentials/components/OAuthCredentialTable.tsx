'use client'
import { useState } from 'react'
import type { FC } from 'react'
import {
  useDeleteOAuthCredential,
  useVerifyOAuthCredential,
} from '../hooks/useOAuthCredentials'
import type { AccountPlatform, OAuthCredential, PlatformStatus } from '../types'
import { OAuthCredentialStatusBadge } from './OAuthCredentialStatusBadge'
import { VerifyCredentialButton } from './VerifyCredentialButton'

const PLATFORM_META: Record<AccountPlatform, { label: string, icon: string, accent: string }> = {
  YOUTUBE: { label: 'YouTube', icon: 'YT', accent: 'bg-red-100 text-red-700' },
  FACEBOOK: { label: 'Facebook', icon: 'FB', accent: 'bg-blue-100 text-blue-700' },
  INSTAGRAM: { label: 'Instagram', icon: 'IG', accent: 'bg-pink-100 text-pink-700' },
  TIKTOK: { label: 'TikTok', icon: 'TT', accent: 'bg-zinc-900 text-white' },
}

const ALL_PLATFORMS: AccountPlatform[] = ['YOUTUBE', 'FACEBOOK', 'INSTAGRAM', 'TIKTOK']

interface OAuthCredentialTableProps {
  statuses: PlatformStatus[]
  credentials: OAuthCredential[]
  onConfigure: (platform: AccountPlatform, existing: OAuthCredential | null) => void
}

export const OAuthCredentialTable: FC<OAuthCredentialTableProps> = ({
  statuses,
  credentials,
  onConfigure,
}) => {
  const verify = useVerifyOAuthCredential()
  const remove = useDeleteOAuthCredential()
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const statusByPlatform = new Map(statuses.map(s => [s.platform, s]))
  const credentialByPlatform = new Map(credentials.map(c => [c.platform, c]))

  return (
    <div className="space-y-3">
      {ALL_PLATFORMS.map((platform) => {
        const status = statusByPlatform.get(platform)
        const credential = credentialByPlatform.get(platform) ?? null
        const meta = PLATFORM_META[platform]
        const source = status?.source ?? 'NONE'
        const hasWorkspaceCustom = source === 'WORKSPACE'

        return (
          <div
            key={platform}
            className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 md:flex-row md:items-center md:justify-between"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={`flex h-10 w-10 items-center justify-center rounded-md text-xs font-bold ${meta.accent}`}>
                {meta.icon}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{meta.label}</p>
                  <OAuthCredentialStatusBadge source={source} />
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground truncate">
                  {hasWorkspaceCustom && credential
                    ? `Client ID: ${credential.clientId} · secret last4=${credential.clientSecretLast4}`
                    : source === 'ENV'
                      ? 'Đang dùng Sociflow default OAuth app'
                      : source === 'SYSTEM'
                        ? 'Đang dùng system credential'
                        : 'Chưa cấu hình — không thể connect qua API mode'}
                </p>
                {status?.lastVerifiedAt && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Verified: {new Date(status.lastVerifiedAt).toLocaleString('vi-VN')}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {credential && (
                <VerifyCredentialButton
                  onVerify={() => verify.mutate(credential.id)}
                  isLoading={verify.isPending && verify.variables === credential.id}
                />
              )}
              <button
                type="button"
                onClick={() => onConfigure(platform, credential)}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
              >
                {hasWorkspaceCustom ? 'Sửa' : 'Cấu hình'}
              </button>
              {hasWorkspaceCustom && credential && confirmId !== credential.id && (
                <button
                  type="button"
                  onClick={() => setConfirmId(credential.id)}
                  className="text-xs text-destructive hover:underline"
                >
                  Reset to default
                </button>
              )}
              {hasWorkspaceCustom && credential && confirmId === credential.id && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-2 py-1">
                  <span className="text-xs">Tất cả account dùng credential này sẽ fail OAuth refresh!</span>
                  <button
                    type="button"
                    onClick={() => {
                      remove.mutate(credential.id, { onSettled: () => setConfirmId(null) })
                    }}
                    disabled={remove.isPending}
                    className="rounded-md bg-destructive px-2 py-1 text-xs font-medium text-destructive-foreground disabled:opacity-50"
                  >
                    {remove.isPending ? 'Đang xoá...' : 'Xác nhận'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmId(null)}
                    className="text-xs hover:underline"
                  >
                    Huỷ
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
