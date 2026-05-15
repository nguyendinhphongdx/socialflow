'use client'
import type { FC } from 'react'
import { useDisconnectAccount } from '../hooks/useAccounts'
import type { SocialAccount } from '../types'

const PLATFORM_LABEL: Record<SocialAccount['platform'], string> = {
  YOUTUBE: 'YouTube',
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  TIKTOK: 'TikTok',
}

const STATUS_LABEL: Record<SocialAccount['status'], { text: string, color: string }> = {
  ACTIVE: { text: 'Hoạt động', color: 'bg-green-100 text-green-800' },
  TOKEN_EXPIRED: { text: 'Hết hạn', color: 'bg-yellow-100 text-yellow-800' },
  REVOKED: { text: 'Đã thu hồi', color: 'bg-red-100 text-red-800' },
  SUSPENDED: { text: 'Tạm khoá', color: 'bg-gray-100 text-gray-800' },
}

export const AccountCard: FC<{ account: SocialAccount }> = ({ account }) => {
  const disconnect = useDisconnectAccount()
  const status = STATUS_LABEL[account.status]

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        {account.avatarUrl
          ? <img src={account.avatarUrl} alt="" className="h-12 w-12 rounded-full" />
          : <div className="h-12 w-12 rounded-full bg-muted" />}
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase text-muted-foreground">{PLATFORM_LABEL[account.platform]}</p>
          <p className="font-semibold truncate">{account.displayName}</p>
          <span className={`mt-1 inline-block rounded px-2 py-0.5 text-xs ${status.color}`}>
            {status.text}
          </span>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => disconnect.mutate(account.id)}
          disabled={disconnect.isPending}
          className="text-xs text-destructive hover:underline"
        >
          Ngắt kết nối
        </button>
      </div>
    </div>
  )
}
