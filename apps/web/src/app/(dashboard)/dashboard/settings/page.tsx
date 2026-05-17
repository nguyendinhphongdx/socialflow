import Link from 'next/link'
import { createMetadata } from '@/lib/seo/metadata'

export const metadata = createMetadata({
  title: 'Settings',
  path: '/dashboard/settings',
  noIndex: true,
})

const SECTIONS = [
  {
    href: '/dashboard/settings/oauth-credentials',
    title: 'OAuth Credentials',
    description: 'Cấu hình OAuth app riêng cho YouTube/Meta/TikTok để dùng API mode (BYOK).',
  },
  {
    href: '/dashboard/settings/ai-credentials',
    title: 'AI Credentials',
    description: 'Cung cấp API key OpenAI/Anthropic/Gemini để track cost + tránh share rate limit.',
  },
  {
    href: '/dashboard/settings/workspaces',
    title: 'Workspaces',
    description: 'Tạo workspace + mời thành viên + phân quyền.',
  },
  {
    href: '/dashboard/settings/billing',
    title: 'Billing',
    description: 'Quản lý gói đăng ký + credits.',
  },
]

export default function Page() {
  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Quản lý cấu hình workspace và tài khoản.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {SECTIONS.map(s => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-lg border border-border bg-card p-4 transition hover:border-primary hover:shadow-sm"
          >
            <h2 className="font-semibold">{s.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
          </Link>
        ))}
      </div>
    </main>
  )
}
