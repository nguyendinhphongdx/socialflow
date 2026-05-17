import Link from 'next/link'
import type { FC } from 'react'
import { FaqItem } from '../components/FaqItem'
import { ContactForm } from '../components/ContactForm'

interface GuideLink {
  title: string
  description: string
  href: string
}

const GUIDES: GuideLink[] = [
  {
    title: 'Connect tài khoản đầu tiên',
    description: 'OAuth flow với Facebook, YouTube, TikTok, Threads và Instagram.',
    href: '/onboarding',
  },
  {
    title: 'Đăng bài đầu tiên',
    description: 'Compose, schedule và publish cho nhiều platform cùng lúc.',
    href: '/onboarding?step=compose',
  },
  {
    title: 'Hiểu pricing và credits',
    description: 'So sánh các gói, cách tính credits AI, billing cycle.',
    href: '/pricing',
  },
]

const FAQS = [
  {
    question: 'Sociflow hỗ trợ những nền tảng nào?',
    answer:
      'Hiện tại Sociflow hỗ trợ Facebook (Page), YouTube, TikTok, Threads, Instagram, Twitter/X và LinkedIn. Một số nền tảng (TikTok, IG Story) cần extension trình duyệt để publish.',
  },
  {
    question: 'Tôi có thể schedule bài trước bao lâu?',
    answer:
      'Lịch tối đa 365 ngày kể từ thời điểm tạo. Gói Free giới hạn 30 ngày, Pro và Business không giới hạn.',
  },
  {
    question: 'Credits AI hoạt động ra sao?',
    answer:
      'Mỗi request AI (caption gen, image gen, agent reply...) tốn credits theo độ phức tạp. Free 100 credits/tháng, Pro 1000, Business 5000. Reset đầu kỳ thanh toán.',
  },
  {
    question: 'Dữ liệu của tôi có an toàn không?',
    answer:
      'Token OAuth lưu encrypted (AES-256-GCM), password hash qua bcrypt. Sociflow không train AI model trên content của bạn. Chi tiết xem trang Privacy.',
  },
  {
    question: 'Làm sao để hủy tài khoản?',
    answer:
      'Vào Cài đặt > Tài khoản > Xóa tài khoản. Toàn bộ data được hard-delete sau 30 ngày grace period theo GDPR và ND-13.',
  },
]

export const HelpView: FC = () => {
  return (
    <main className="container mx-auto max-w-5xl space-y-16 px-4 py-16">
      <section className="text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Trung tâm trợ giúp
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          Hướng dẫn từng bước, câu hỏi thường gặp và kênh liên hệ trực tiếp với
          đội ngũ hỗ trợ.
        </p>
      </section>

      <section>
        <h2 className="mb-6 text-2xl font-semibold">Bắt đầu</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {GUIDES.map((guide) => (
            <Link
              key={guide.href}
              href={guide.href}
              className="group rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary"
            >
              <h3 className="font-semibold group-hover:text-primary">
                {guide.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {guide.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl">
        <h2 className="mb-6 text-2xl font-semibold">Câu hỏi thường gặp</h2>
        <div className="space-y-3">
          {FAQS.map((faq) => (
            <FaqItem key={faq.question} {...faq} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl">
        <h2 className="mb-6 text-2xl font-semibold">Liên hệ</h2>
        <ContactForm />
      </section>

      <footer className="border-t border-border pt-8 text-center text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <Link href="/legal/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="/legal/terms" className="hover:text-foreground">
            Terms
          </Link>
          <Link href="/status" className="hover:text-foreground">
            Trạng thái hệ thống
          </Link>
        </div>
      </footer>
    </main>
  )
}
