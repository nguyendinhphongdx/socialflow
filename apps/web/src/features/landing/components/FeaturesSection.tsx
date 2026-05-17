import type { FC } from 'react'

interface Feature {
  title: string
  description: string
  icon: FC
}

const Icon = {
  Globe: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20" />
    </svg>
  ),
  Sparkles: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
      <path d="M12 3l1.9 5.8L20 10l-5.8 2L12 18l-2.2-6L4 10l6.1-1.2L12 3zM19 17l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2zM5 17l.5 1.5L7 19l-1.5.5L5 21l-.5-1.5L3 19l1.5-.5L5 17z" />
    </svg>
  ),
  ChatBubble: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
    </svg>
  ),
  Chart: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
      <path d="M3 3v18h18M7 14l4-4 4 4 5-5" />
    </svg>
  ),
}

const FEATURES: Feature[] = [
  {
    title: 'Đăng đa nền tảng',
    description: 'Một lần soạn nội dung, đăng đồng thời lên 4+ nền tảng. Tự động adapt format theo từng platform.',
    icon: Icon.Globe,
  },
  {
    title: 'AI viết caption',
    description: 'GPT-4 hiểu thương hiệu của bạn. Sinh hashtag, caption, ý tưởng video phù hợp với audience VN.',
    icon: Icon.Sparkles,
  },
  {
    title: 'Auto-reply comment',
    description: 'Bot AI tự trả lời comment trên FB/IG/TikTok 24/7. Lọc spam, đẩy lead qua DM tự động.',
    icon: Icon.ChatBubble,
  },
  {
    title: 'Analytics chi tiết',
    description: 'Track reach, engagement, follower growth real-time. So sánh giữa các platform để tối ưu chiến lược.',
    icon: Icon.Chart,
  },
]

export const FeaturesSection: FC = () => {
  return (
    <section id="features" className="border-t border-border/60 bg-muted/30 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Mọi công cụ creator cần, trong 1 nơi
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Tiết kiệm 20+ giờ/tháng. Tập trung sáng tạo nội dung, để Sociflow lo phần còn lại.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => {
            const IconCmp = feature.icon
            return (
              <div
                key={feature.title}
                className="group relative overflow-hidden rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/40 hover:shadow-lg"
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <IconCmp />
                </div>
                <h3 className="text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
