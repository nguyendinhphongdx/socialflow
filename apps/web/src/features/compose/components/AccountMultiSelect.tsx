'use client'
import { useAccounts, type SocialAccount } from '@/features/accounts'

interface AccountMultiSelectProps {
  selected: string[]
  onChange: (ids: string[]) => void
}

const PLATFORM_COLOR: Record<SocialAccount['platform'], string> = {
  YOUTUBE: 'bg-red-100 text-red-800',
  FACEBOOK: 'bg-blue-100 text-blue-800',
  INSTAGRAM: 'bg-pink-100 text-pink-800',
  TIKTOK: 'bg-zinc-100 text-zinc-800',
}

export function AccountMultiSelect({ selected, onChange }: AccountMultiSelectProps) {
  const { data, isLoading } = useAccounts()
  const accounts = data?.list.filter(a => a.status === 'ACTIVE') ?? []

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id])
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Đang tải tài khoản...</p>
  if (accounts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Chưa có tài khoản ACTIVE. <a href="/dashboard/accounts" className="text-primary hover:underline">Connect ngay</a>.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
      {accounts.map(account => {
        const isSelected = selected.includes(account.id)
        return (
          <button
            key={account.id}
            type="button"
            onClick={() => toggle(account.id)}
            className={`flex items-center gap-3 rounded-md border p-3 text-left transition-colors ${
              isSelected ? 'border-primary bg-accent' : 'border-border hover:bg-accent/50'
            }`}
          >
            <input type="checkbox" checked={isSelected} onChange={() => {}} className="h-4 w-4" />
            {account.avatarUrl
              ? <img src={account.avatarUrl} alt="" className="h-8 w-8 rounded-full" />
              : <div className="h-8 w-8 rounded-full bg-muted" />}
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium">{account.displayName}</p>
              <span className={`inline-block rounded px-1.5 text-xs ${PLATFORM_COLOR[account.platform]}`}>
                {account.platform}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
