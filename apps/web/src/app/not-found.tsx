import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h2 className="text-3xl font-bold">404</h2>
      <p className="text-muted-foreground">Không tìm thấy trang</p>
      <Link href="/" className="text-primary hover:underline">Về trang chủ</Link>
    </div>
  )
}
