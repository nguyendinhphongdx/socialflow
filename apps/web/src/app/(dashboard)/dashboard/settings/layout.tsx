'use client'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
  href: string
  label: string
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard/settings', label: 'General' },
  { href: '/dashboard/settings/oauth-credentials', label: 'OAuth Credentials' },
  { href: '/dashboard/settings/ai-credentials', label: 'AI Credentials' },
  { href: '/dashboard/settings/workspaces', label: 'Workspaces' },
  { href: '/dashboard/settings/billing', label: 'Billing' },
]

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  return (
    <div className="container mx-auto max-w-6xl gap-6 px-4 py-8 md:flex">
      <aside className="md:w-56 md:shrink-0">
        <nav className="sticky top-4 space-y-1">
          <h2 className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Settings
          </h2>
          {NAV_ITEMS.map((item) => {
            const isActive
              = item.href === '/dashboard/settings'
                ? pathname === item.href
                : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-md px-3 py-2 text-sm transition ${
                  isActive
                    ? 'bg-accent font-semibold text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
