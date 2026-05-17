import type { ReactNode } from 'react'
import Link from 'next/link'

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold">Sociflow</Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/legal/privacy" className="hover:underline">Privacy</Link>
            <Link href="/legal/terms" className="hover:underline">Terms</Link>
            <Link href="/auth/data-deletion" className="hover:underline">Data Deletion</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-12 prose prose-slate dark:prose-invert">
        {children}
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto max-w-4xl px-6 py-6 text-sm text-muted-foreground">
          © {new Date().getFullYear()} Sociflow. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
