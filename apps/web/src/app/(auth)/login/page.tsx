import { createMetadata } from '@/lib/seo/metadata'

export const metadata = createMetadata({ title: 'Đăng nhập', path: '/login', noIndex: true })

export default function LoginPage() {
  return (
    <main className="container flex min-h-screen items-center justify-center py-16">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">Đăng nhập</h1>
        <p className="text-sm text-muted-foreground">
          Trang form sẽ build trong Phase 1. Hiện tại endpoint <code>/api/v1/auth/login</code> đã sẵn sàng.
        </p>
      </div>
    </main>
  )
}
