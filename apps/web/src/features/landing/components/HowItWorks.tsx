import type { FC } from 'react'

interface Step {
  number: string
  title: string
  description: string
}

const STEPS: Step[] = [
  {
    number: '01',
    title: 'Connect',
    description: 'Kết nối YouTube, Facebook, Instagram, TikTok chỉ với 1 click OAuth. Token được mã hóa AES-256-GCM.',
  },
  {
    number: '02',
    title: 'Compose',
    description: 'Viết nội dung 1 lần. AI tự adapt caption + hashtag cho từng nền tảng. Lên lịch hoặc đăng ngay.',
  },
  {
    number: '03',
    title: 'Analyze',
    description: 'Theo dõi reach, engagement, comment. AI gợi ý nội dung tiếp theo dựa trên hiệu suất thực tế.',
  },
]

export const HowItWorks: FC = () => {
  return (
    <section id="how-it-works" className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">3 bước để bắt đầu</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Setup dưới 5 phút. Không cần kỹ thuật, không cần training.
          </p>
        </div>

        <div className="relative mt-16 grid gap-8 md:grid-cols-3">
          <div className="pointer-events-none absolute left-0 top-12 hidden h-px w-full bg-gradient-to-r from-transparent via-border to-transparent md:block" />

          {STEPS.map((step) => (
            <div key={step.number} className="relative flex flex-col items-center text-center">
              <div className="relative z-10 flex h-24 w-24 items-center justify-center rounded-full border border-border bg-card shadow-sm">
                <span className="bg-gradient-to-br from-primary to-purple-500 bg-clip-text text-3xl font-bold text-transparent">
                  {step.number}
                </span>
              </div>
              <h3 className="mt-6 text-xl font-semibold">{step.title}</h3>
              <p className="mt-3 max-w-xs text-sm text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
