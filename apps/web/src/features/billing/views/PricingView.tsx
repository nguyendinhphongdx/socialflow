'use client'
import Link from 'next/link'
import { useAuth } from '@/features/auth'
import { PricingTable } from '../components/PricingTable'

const FAQS = [
  {
    q: 'Đổi gói có được hoàn tiền không?',
    a: 'Khi upgrade trong kỳ, hệ thống pro-rate phần còn lại. Khi downgrade, gói cũ vẫn dùng tới hết kỳ rồi mới chuyển — không hoàn tiền chênh lệch.',
  },
  {
    q: 'Credits chưa dùng có rollover sang tháng sau?',
    a: 'Mặc định credits reset đầu mỗi kỳ. Gói Business trở lên hỗ trợ rollover tối đa 1 tháng.',
  },
  {
    q: 'Có thể hủy bất cứ lúc nào không?',
    a: 'Bạn có thể hủy trong trang Cài đặt > Billing. Gói vẫn hoạt động đến cuối kỳ đã thanh toán.',
  },
  {
    q: 'Có gói dùng thử miễn phí cho Pro/Business không?',
    a: 'Hiện tại chúng tôi tặng 100 credits/tháng cho gói Free để bạn trải nghiệm. Liên hệ sales nếu cần demo Business/Enterprise.',
  },
]

export function PricingView() {
  const { user } = useAuth()
  return (
    <main className="container mx-auto max-w-6xl space-y-16 px-4 py-16">
      <section className="text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Chọn gói phù hợp với bạn
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          Bắt đầu miễn phí, nâng cấp khi cần. Mọi gói đều bao gồm publish đa nền tảng + AI content generation.
        </p>
      </section>

      <section>
        <PricingTable currentPlan={user?.planTier ?? null} />
      </section>

      <section className="mx-auto max-w-3xl">
        <h2 className="mb-6 text-2xl font-semibold">Câu hỏi thường gặp</h2>
        <div className="space-y-4">
          {FAQS.map((item) => (
            <details
              key={item.q}
              className="group rounded-lg border border-border bg-card p-4"
            >
              <summary className="cursor-pointer list-none font-medium">
                <span className="inline-flex w-full items-center justify-between">
                  {item.q}
                  <span className="text-muted-foreground transition-transform group-open:rotate-180">
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                      <path
                        fillRule="evenodd"
                        d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                </span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="text-center text-sm text-muted-foreground">
        Câu hỏi khác?{' '}
        <Link href="mailto:support@sociflow.io" className="font-medium text-primary hover:underline">
          Liên hệ với chúng tôi
        </Link>
      </section>
    </main>
  )
}
