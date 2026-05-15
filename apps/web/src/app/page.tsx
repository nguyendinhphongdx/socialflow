import Link from 'next/link'
import { createMetadata } from '@/lib/seo/metadata'

export const metadata = createMetadata({ title: 'Home', path: '/' })

export default function HomePage() {
  return (
    <main className="container flex min-h-screen flex-col items-center justify-center gap-6 py-16">
      <h1 className="text-4xl font-bold tracking-tight">Sociflow</h1>
      <p className="text-lg text-muted-foreground">AI-powered social media publishing</p>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-primary-foreground hover:bg-primary/90"
        >
          Đăng nhập
        </Link>
        <Link
          href="/register"
          className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-6 hover:bg-accent"
        >
          Đăng ký
        </Link>
      </div>
    </main>
  )
}
