'use client'
import Link from 'next/link'
import type { FC } from 'react'
import type { AccountPlatform, PublishMode } from '../types'

interface SuccessStepProps {
  platform: AccountPlatform
  mode: PublishMode
  onReset: () => void
}

const PLATFORM_LABEL: Record<AccountPlatform, string> = {
  YOUTUBE: 'YouTube',
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  TIKTOK: 'TikTok',
}

export const SuccessStep: FC<SuccessStepProps> = ({ platform, mode, onReset }) => {
  return (
    <div className="space-y-5 rounded-lg border border-emerald-300 bg-emerald-50 p-6 text-center dark:border-emerald-900/40 dark:bg-emerald-950/30">
      <div>
        <h2 className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
          Đã kết nối!
        </h2>
        <p className="mt-1 text-sm text-emerald-900/80 dark:text-emerald-100/80">
          {PLATFORM_LABEL[platform]} sẵn sàng publish qua {mode} mode.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link
          href="/dashboard/accounts"
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Xem danh sách tài khoản →
        </Link>
        <Link
          href="/dashboard/compose"
          className="rounded-md border border-emerald-700 bg-transparent px-4 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-100 dark:text-emerald-100 dark:hover:bg-emerald-900/40"
        >
          Tạo post mới
        </Link>
        <button
          type="button"
          onClick={onReset}
          className="text-sm text-emerald-900/80 hover:underline dark:text-emerald-100/80"
        >
          Kết nối tài khoản khác
        </button>
      </div>
    </div>
  )
}
