import Link from 'next/link'
import type { FC } from 'react'

interface FooterColumn {
  title: string
  links: { href: string, label: string }[]
}

const COLUMNS: FooterColumn[] = [
  {
    title: 'Sản phẩm',
    links: [
      { href: '/#features', label: 'Tính năng' },
      { href: '/pricing', label: 'Bảng giá' },
      { href: '/#how-it-works', label: 'Cách dùng' },
      { href: '/status', label: 'Trạng thái' },
    ],
  },
  {
    title: 'Công ty',
    links: [
      { href: '/about', label: 'Giới thiệu' },
      { href: 'mailto:hello@sociflow.io', label: 'Liên hệ' },
      { href: 'mailto:careers@sociflow.io', label: 'Tuyển dụng' },
    ],
  },
  {
    title: 'Pháp lý',
    links: [
      { href: '/legal/privacy', label: 'Privacy Policy' },
      { href: '/legal/terms', label: 'Terms of Service' },
      { href: '/auth/data-deletion', label: 'Data Deletion' },
    ],
  },
]

export const Footer: FC = () => {
  return (
    <footer className="border-t border-border/60 bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                S
              </span>
              <span className="text-lg font-semibold tracking-tight">Sociflow</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              AI-powered social media publishing & automation cho creator và agency Việt Nam.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold">{col.title}</h3>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-border pt-8 sm:flex-row sm:items-center">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Sociflow. All rights reserved.
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            <span>All systems operational</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
