'use client'
import { useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { useAccounts } from '../hooks/useAccounts'
import { connectAccountUrl } from '../services/accountService'
import { AccountCard } from '../components/AccountCard'

export function AccountsView() {
  const { data, isLoading } = useAccounts()
  const search = useSearchParams()

  useEffect(() => {
    const connected = search.get('connected')
    const error = search.get('error')
    if (connected) toast.success('Kết nối tài khoản thành công')
    if (error) toast.error(`OAuth lỗi: ${error}`)
  }, [search])

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tài khoản</h1>
        <div className="flex gap-2">
          <a
            href={connectAccountUrl('youtube')}
            className="inline-flex h-10 items-center justify-center rounded-md bg-red-600 px-4 text-sm text-white hover:bg-red-700"
          >
            + YouTube
          </a>
          <a
            href={connectAccountUrl('facebook')}
            className="inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-4 text-sm text-white hover:bg-blue-700"
          >
            + Facebook
          </a>
          <a
            href={connectAccountUrl('instagram')}
            className="inline-flex h-10 items-center justify-center rounded-md bg-gradient-to-r from-purple-600 to-pink-600 px-4 text-sm text-white hover:opacity-90"
          >
            + Instagram
          </a>
          <a
            href={connectAccountUrl('tiktok')}
            className="inline-flex h-10 items-center justify-center rounded-md bg-black px-4 text-sm text-white hover:bg-zinc-800"
          >
            + TikTok
          </a>
        </div>
      </header>

      {isLoading && <p className="text-muted-foreground">Đang tải...</p>}

      {!isLoading && data?.list.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground">Chưa có tài khoản nào</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Click <b>+ YouTube</b> hoặc <b>+ Facebook</b> để bắt đầu.
          </p>
        </div>
      )}

      {data && data.list.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.list.map(a => <AccountCard key={a.id} account={a} />)}
        </div>
      )}
    </div>
  )
}
