import { LandingView } from '@/features/landing'
import { createMetadata } from '@/lib/seo/metadata'

export const metadata = createMetadata({
  title: 'Sociflow — Quản lý social media AI-powered cho creator VN',
  description:
    'Tăng tốc nội dung 10x: đăng 4 nền tảng cùng lúc, AI viết caption, auto-reply comment, analytics chi tiết. Dành cho creator & agency Việt Nam.',
  path: '/',
})

export default function HomePage() {
  return <LandingView />
}
