import Link from 'next/link'
import type { FC } from 'react'

export const Navbar: FC = () => {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            S
          </span>
          <span className="text-lg font-semibold tracking-tight">Sociflow</span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <Link href="#features" className="transition-colors hover:text-foreground">Tính năng</Link>
          <Link href="#how-it-works" className="transition-colors hover:text-foreground">Cách dùng</Link>
          <Link href="/pricing" className="transition-colors hover:text-foreground">Bảng giá</Link>
          <Link href="/status" className="transition-colors hover:text-foreground">Trạng thái</Link>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Đăng nhập
          </Link>
          <Link
            href="/register"
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            Dùng thử miễn phí
          </Link>
        </div>
      </div>
    </header>
  )
}
