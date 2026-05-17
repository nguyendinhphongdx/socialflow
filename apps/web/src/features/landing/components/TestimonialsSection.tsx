import type { FC } from 'react'

interface Testimonial {
  quote: string
  author: string
  role: string
  initials: string
}

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      'Trước đây tôi mất 3 tiếng/ngày để đăng bài lên 4 kênh. Giờ chỉ 15 phút. Đặc biệt là AI viết caption tiếng Việt mượt, không cảm giác máy móc.',
    author: 'Nguyễn Thu Hà',
    role: 'Creator du lịch · 250K followers',
    initials: 'TH',
  },
  {
    quote:
      'Sociflow giúp team agency của tôi quản lý 30+ client trên 1 dashboard. Auto-reply giảm 70% workload chăm sóc fanpage.',
    author: 'Phạm Minh Đức',
    role: 'Founder, Adstars Agency',
    initials: 'MĐ',
  },
  {
    quote:
      'Analytics gộp 4 platform vào 1 view giúp tôi thấy được kênh nào đang work. Quyết định content tốt hơn nhiều so với check từng app.',
    author: 'Lê Quốc Bảo',
    role: 'Brand Manager · F&B Startup',
    initials: 'QB',
  },
]

export const TestimonialsSection: FC = () => {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Creator & agency tin dùng
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Hơn 5.000 creator và 200+ agency Việt Nam đang dùng Sociflow mỗi ngày.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure
              key={t.author}
              className="flex flex-col rounded-xl border border-border bg-card p-6 shadow-sm"
            >
              <div className="mb-4 flex gap-1 text-amber-500" aria-label="5 sao">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg key={i} viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path d="M10 1l2.6 6.4 6.9.5-5.3 4.6 1.7 6.7L10 15.6l-5.9 3.6 1.7-6.7L.5 7.9l6.9-.5L10 1z" />
                  </svg>
                ))}
              </div>
              <blockquote className="flex-1 text-sm leading-relaxed text-foreground">
                "{t.quote}"
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3 border-t border-border pt-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {t.initials}
                </div>
                <div>
                  <div className="text-sm font-semibold">{t.author}</div>
                  <div className="text-xs text-muted-foreground">{t.role}</div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
